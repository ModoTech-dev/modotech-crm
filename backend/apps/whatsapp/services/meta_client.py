"""
Thin client around the WhatsApp Business Platform. Supports two provider
modes, since they use genuinely different HTTP formats:

- "meta" (default): direct Meta Graph API access — base URL
  graph.facebook.com, phone_number_id in the URL path, `Authorization:
  Bearer <token>` header. This is what a Tech Provider / direct Cloud
  API integration uses.
- "360dialog": 360dialog's own proxy API — base URL waba-v2.360dialog.io,
  NO phone_number_id in the path (360dialog already knows which number
  your API key is scoped to; including it causes errors per their own
  docs), and a `D360-API-KEY: <key>` header instead of a Bearer token.
  This is what you get when onboarding via 360dialog's Coexistence flow
  rather than becoming a Meta Tech Provider directly.

Set WHATSAPP_PROVIDER=360dialog in .env to switch modes. Inbound webhook
payloads are unaffected either way — 360dialog forwards Meta's own
webhook format unchanged, so apps/whatsapp/tasks.py needs no changes.
"""
from __future__ import annotations

import requests
from django.conf import settings


class WhatsAppAPIError(Exception):
    pass


class WhatsAppClient:
    def __init__(self):
        self.provider = getattr(settings, "WHATSAPP_PROVIDER", "meta")
        self.access_token = settings.WHATSAPP_ACCESS_TOKEN
        self.phone_number_id = settings.WHATSAPP_PHONE_NUMBER_ID

        if self.provider == "360dialog":
            # e.g. https://waba-v2.360dialog.io — no API version suffix,
            # 360dialog handles that internally.
            self.base_url = settings.WHATSAPP_GRAPH_BASE_URL
        else:
            self.base_url = f"{settings.WHATSAPP_GRAPH_BASE_URL}/{settings.WHATSAPP_API_VERSION}"

    @property
    def _headers(self):
        if self.provider == "360dialog":
            return {"D360-API-KEY": self.access_token, "Content-Type": "application/json"}
        return {"Authorization": f"Bearer {self.access_token}", "Content-Type": "application/json"}

    def _messages_url(self):
        if self.provider == "360dialog":
            # No phone_number_id in the path for 360dialog — the API key
            # itself is already scoped to a specific number.
            return f"{self.base_url}/messages"
        return f"{self.base_url}/{self.phone_number_id}/messages"

    def send_message(
        self,
        to: str,
        message_type: str = "TEXT",
        content: str = "",
        template_name: str | None = None,
        template_variables: dict | None = None,
        media_path: str | None = None,
        media_id: str | None = None,
        location: dict | None = None,
    ) -> str:
        """Sends an outbound message and returns the provider's message id.
        Raises WhatsAppAPIError on failure so callers can surface a
        retry/error state instead of silently losing the message.

        For media messages, prefer media_id (from upload_media()) over
        media_path (a public URL) — it works regardless of whether your
        own server is publicly reachable, and is the standard approach
        for files that originate from your own system rather than
        already being hosted somewhere else."""
        if not self.access_token:
            raise WhatsAppAPIError("WhatsApp API is not configured (missing access token / API key).")
        if self.provider != "360dialog" and not self.phone_number_id:
            raise WhatsAppAPIError("WhatsApp Cloud API is not configured (missing phone number id).")

        payload = self._build_payload(
            to, message_type, content, template_name, template_variables, media_path, location, media_id
        )

        response = requests.post(self._messages_url(), headers=self._headers, json=payload, timeout=15)
        if response.status_code >= 400:
            raise WhatsAppAPIError(f"WhatsApp send failed ({response.status_code}): {response.text}")

        data = response.json()
        return data["messages"][0]["id"]

    def _build_payload(self, to, message_type, content, template_name, template_variables, media_path, location=None, media_id=None):
        base = {"messaging_product": "whatsapp", "to": to}

        if message_type == "TEMPLATE":
            components = []
            if template_variables:
                components.append({
                    "type": "body",
                    "parameters": [{"type": "text", "text": str(v)} for v in template_variables.values()],
                })
            base.update({
                "type": "template",
                "template": {"name": template_name, "language": {"code": "en"}, "components": components},
            })
        elif message_type == "LOCATION":
            location = location or {}
            loc_payload = {
                "latitude": location.get("latitude"),
                "longitude": location.get("longitude"),
            }
            if location.get("name"):
                loc_payload["name"] = location["name"]
            if location.get("address"):
                loc_payload["address"] = location["address"]
            base.update({"type": "location", "location": loc_payload})
        elif message_type in {"IMAGE", "DOCUMENT", "AUDIO", "VIDEO"}:
            media_object = {"id": media_id} if media_id else {"link": media_path}
            base.update({"type": message_type.lower(), message_type.lower(): media_object})
        else:
            base.update({"type": "text", "text": {"body": content}})

        return base

    def get_templates(self) -> list[dict]:
        """
        Fetches all templates and their current real status directly from
        360dialog — GET /v1/configs/templates, confirmed against their
        own current documentation. Only implemented for 360dialog mode:
        direct Meta Graph API uses a different endpoint shape I haven't
        verified, so this raises clearly rather than guessing at an
        unconfirmed path.
        """
        if self.provider != "360dialog":
            raise WhatsAppAPIError("get_templates is only implemented for the 360dialog provider.")

        resp = requests.get(
            f"{self.base_url}/v1/configs/templates",
            headers=self._headers,
            params={"limit": 1000},
            timeout=15,
        )
        if resp.status_code != 200:
            raise WhatsAppAPIError(f"Failed to fetch templates: {resp.status_code} {resp.text}")
        return resp.json().get("waba_templates", [])

    def upload_media(self, content: bytes, mime_type: str, filename: str) -> str:
        """
        Uploads a file to the provider so it can be referenced by media_id
        in send_message() — the standard way to send a file that
        originates from your own system (an agent's upload) rather than
        one already hosted at a public URL.

        Endpoint confirmed directly against docs.360dialog.com:
        POST https://waba-v2.360dialog.io/media
        """
        if not self.access_token:
            raise WhatsAppAPIError("WhatsApp API is not configured (missing access token / API key).")

        url = f"{self.base_url}/media" if self.provider == "360dialog" else f"{self.base_url}/{self.phone_number_id}/media"
        headers = {k: v for k, v in self._headers.items() if k != "Content-Type"}  # let requests set multipart boundary

        files = {"file": (filename, content, mime_type)}
        data = {"messaging_product": "whatsapp", "type": mime_type}

        response = requests.post(url, headers=headers, files=files, data=data, timeout=30)
        if response.status_code >= 400:
            raise WhatsAppAPIError(f"WhatsApp media upload failed ({response.status_code}): {response.text}")

        return response.json()["id"]

    def download_media(self, media_id: str) -> tuple[bytes, str]:
        """Returns (raw_bytes, mime_type). Must be called immediately on
        webhook receipt — media URLs expire after a few minutes.

        The first step (GET /{media_id}) is the same for both providers
        and returns metadata plus a Facebook CDN URL (lookaside.fbsbx.com)
        where the file actually lives. What differs is how you're allowed
        to fetch it:

        - Direct Meta: that CDN URL accepts your Meta Bearer token
          directly — just GET it.
        - 360dialog: that CDN URL does NOT accept a D360-API-KEY (it's
          Facebook's own infrastructure, expecting Meta's own auth
          scheme). Per docs.360dialog.com, you instead re-request the
          same file — using the mid/ext/hash/source query parameters
          already present in that returned URL — against 360dialog's
          own proxied endpoint (waba-v2.360dialog.io/whatsapp_business/
          attachments/), authenticated with your D360-API-KEY like
          everything else. `source` matters and genuinely varies: a
          regular customer message uses getMedia, but media sent from
          the linked phone (smb_message_echoes) uses webhook instead —
          confirmed from real captured payloads, not assumed. Reading
          it from the URL rather than hardcoding either value is what
          makes both paths work; hardcoding one silently breaks the
          other. This was the actual cause of inbound attachments not
          appearing in the CRM until this fix.
        """
        meta_resp = requests.get(f"{self.base_url}/{media_id}", headers=self._headers, timeout=15)
        meta_resp.raise_for_status()
        media_url = meta_resp.json()["url"]
        mime_type = meta_resp.json().get("mime_type", "application/octet-stream")

        if self.provider == "360dialog":
            from urllib.parse import urlparse, parse_qs

            query = parse_qs(urlparse(media_url).query)
            mid = query.get("mid", [None])[0]
            ext = query.get("ext", [None])[0]
            file_hash = query.get("hash", [None])[0]
            # The 'source' value genuinely differs by context — a
            # regular customer message uses getMedia, but a message
            # sent from the linked phone (smb_message_echoes) uses
            # webhook instead, confirmed from real captured payloads.
            # Hardcoding either one breaks the other; the original URL
            # already carries the correct value for whichever case this
            # actually is, so read it from there rather than assume.
            source = query.get("source", [None])[0]
            if not (mid and ext and file_hash and source):
                raise WhatsAppAPIError(
                    f"Couldn't parse mid/source/ext/hash from 360dialog's media URL: {media_url}"
                )
            download_url = (
                f"{self.base_url}/whatsapp_business/attachments/"
                f"?mid={mid}&source={source}&ext={ext}&hash={file_hash}"
            )
        else:
            download_url = media_url

        file_resp = requests.get(download_url, headers=self._headers, timeout=30)
        file_resp.raise_for_status()
        return file_resp.content, mime_type


def get_whatsapp_client() -> WhatsAppClient:
    return WhatsAppClient()

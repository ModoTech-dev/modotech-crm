"""
Inbound webhook signature verification. Two schemes are supported,
matching whichever provider WHATSAPP_PROVIDER selects (see
apps/whatsapp/services/meta_client.py for the equivalent outbound split):

- Direct Meta Cloud API: signs the raw body with the Meta App Secret,
  sent as `X-Hub-Signature-256: sha256=<hex>`.
- 360dialog: signs the raw body with a separately-generated 360dialog
  "Platform Secret" (NOT the Meta App Secret — a different value you
  generate in 360dialog Hub), sent as `x-360dialog-signature: <hex>`
  (no "sha256=" prefix).
"""
import hashlib
import hmac

from django.conf import settings


def verify_signature(raw_body: bytes, headers) -> bool:
    provider = getattr(settings, "WHATSAPP_PROVIDER", "meta")

    if provider == "360dialog":
        return _verify_360dialog(raw_body, headers.get("X-360dialog-Signature"))
    return _verify_meta(raw_body, headers.get("X-Hub-Signature-256"))


def _verify_meta(raw_body: bytes, signature_header: str | None) -> bool:
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    if not settings.WHATSAPP_APP_SECRET:
        # Refuse to silently accept unverifiable webhooks outside local dev.
        return settings.DEBUG

    expected = hmac.new(
        settings.WHATSAPP_APP_SECRET.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    provided = signature_header.split("sha256=", 1)[1]
    return hmac.compare_digest(expected, provided)


def _verify_360dialog(raw_body: bytes, signature_header: str | None) -> bool:
    # Deliberate, explicit opt-out — set only after confirming with
    # 360dialog support that Platform Secret genuinely isn't available
    # for this account type (it appears to be Partner Hub-only, not
    # available to regular Client accounts, based on their own docs).
    # This is a real security tradeoff, made knowingly: without a
    # shared secret, there's no cryptographic proof a webhook actually
    # came from 360dialog. The practical exposure is limited (an
    # attacker would need to specifically discover this exact URL, and
    # could only inject fake conversation data, not access real
    # customer data or send real messages) — but it is a real gap, and
    # this flag exists so that gap is visible in the codebase, not
    # silently accepted.
    if not getattr(settings, "WHATSAPP_REQUIRE_WEBHOOK_SIGNATURE", True):
        return True

    webhook_secret = getattr(settings, "WHATSAPP_WEBHOOK_SECRET", "")

    if not webhook_secret:
        # You likely haven't generated a 360dialog Platform Secret yet —
        # see docs.360dialog.com "Generate Platform Secret". Accept in
        # DEBUG so local/dev testing isn't blocked, but this must be set
        # (or WHATSAPP_REQUIRE_WEBHOOK_SIGNATURE explicitly disabled)
        # before going to production, same as the Meta path above.
        return settings.DEBUG

    if not signature_header:
        return False

    expected = hmac.new(webhook_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)

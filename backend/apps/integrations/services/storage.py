"""
Media storage abstraction for WhatsApp attachments. Defaults to Django's
local FileSystemStorage; swap in S3Boto3Storage / a Cloudflare R2 or
DigitalOcean Spaces backend later purely via settings, no code changes
in the whatsapp app that calls save_media().
"""
import re

from django.core.files.storage import default_storage


def sanitize_filename(value: str) -> str:
    """
    Any filename that ends up in a URL path — not a query string, where
    it would be encoded and unremarkable — needs to be safe there. This
    matters for two genuinely different sources: WhatsApp message IDs
    (base64-encoded, can contain '=', '/', '+') used to build inbound
    attachment filenames, and an agent's own uploaded filename when
    sending media out, which could just as easily carry spaces or
    unusual punctuation. Centralizing this in the one function every
    caller of save_media/save_internal_attachment goes through means
    nobody has to remember to sanitize on their own — new callers get
    this protection automatically.
    """
    return re.sub(r"[^A-Za-z0-9._-]", "_", value)


def save_media(filename: str, content: bytes) -> str:
    """Saves raw bytes and returns the storage path (not a public URL)."""
    from django.core.files.base import ContentFile

    path = default_storage.save(f"whatsapp_media/{sanitize_filename(filename)}", ContentFile(content))
    return path


def save_internal_attachment(filename: str, content: bytes) -> str:
    """Same storage backend as WhatsApp media, kept in its own folder
    since these are files staff share with each other internally, not
    anything ever sent to a customer."""
    from django.core.files.base import ContentFile

    path = default_storage.save(f"internal_attachments/{sanitize_filename(filename)}", ContentFile(content))
    return path


def media_url(path: str) -> str:
    return default_storage.url(path)

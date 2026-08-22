"""
Media storage abstraction for WhatsApp attachments. Defaults to Django's
local FileSystemStorage; swap in S3Boto3Storage / a Cloudflare R2 or
DigitalOcean Spaces backend later purely via settings, no code changes
in the whatsapp app that calls save_media().
"""
from django.core.files.storage import default_storage


def save_media(filename: str, content: bytes) -> str:
    """Saves raw bytes and returns the storage path (not a public URL)."""
    from django.core.files.base import ContentFile

    path = default_storage.save(f"whatsapp_media/{filename}", ContentFile(content))
    return path


def media_url(path: str) -> str:
    return default_storage.url(path)

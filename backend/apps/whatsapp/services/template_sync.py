"""
Pulls the real approval status and content of templates directly from
360dialog, rather than requiring someone to manually mirror that
information by hand after checking the Hub. 360dialog's own status
vocabulary is much richer than what we track internally (In-Review,
Active - High/Medium/Low Quality, Paused, Disabled, Appeal Requested,
etc., confirmed against their current docs) — this maps that onto our
simpler four-state model based on what actually matters operationally:
can this be used to send a message right now, or not.

One real simplification worth knowing: Paused and Disabled both map to
REJECTED here, even though they're meaningfully different states (a
paused template recovers on its own after a few hours; a disabled one
doesn't). Our model doesn't distinguish "temporarily can't send" from
"permanently rejected" — if that distinction ever matters operationally,
this mapping is the place to revisit.
"""


def _map_status(external_status: str) -> str:
    normalized = (external_status or "").strip().lower()
    if normalized.startswith("active") or normalized == "approved":
        return "APPROVED"
    if normalized in {"pending", "in-review", "submitted"}:
        return "PENDING"
    return "REJECTED"  # covers rejected, paused, disabled, appeal requested


def _extract_body(components: list[dict]) -> str:
    for component in components or []:
        if (component.get("type") or "").upper() == "BODY":
            return component.get("text", "")
    return ""


def sync_templates_from_360dialog() -> dict:
    from apps.whatsapp.models import MessageTemplate
    from .meta_client import get_whatsapp_client, WhatsAppAPIError

    client = get_whatsapp_client()
    try:
        remote_templates = client.get_templates()
    except WhatsAppAPIError as exc:
        return {"error": str(exc), "created": 0, "updated": 0}

    created = 0
    updated = 0
    for remote in remote_templates:
        name = remote.get("name")
        if not name:
            continue

        template, was_created = MessageTemplate.objects.update_or_create(
            name=name,
            defaults={
                "status": _map_status(remote.get("status")),
                "body": _extract_body(remote.get("components")),
                "language": remote.get("language", "en"),
                "category": remote.get("category", "UTILITY"),
                # 360dialog's docs show this key with a literal space
                # ("external id") in one place and "external_id" in
                # another — checking both rather than trusting either
                # spelling alone.
                "meta_template_id": remote.get("external_id") or remote.get("external id", ""),
            },
        )
        if was_created:
            created += 1
        else:
            updated += 1

    return {"created": created, "updated": updated, "total_fetched": len(remote_templates)}

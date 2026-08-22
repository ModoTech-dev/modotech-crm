"""
Restricts who can see a customer's full WhatsApp number. Enforced at the
API layer (serializers return an already-masked string to anyone who
isn't Super Admin) rather than just hidden in the frontend — a masked
value never leaves the server for those users, so it can't be recovered
via browser dev tools, the network tab, or any other client-side means.

Masking format matches Safaricom's own M-Pesa transaction-masking
convention (see mask_phone_number below) rather than an arbitrary
scheme, since that's the format Kenyan users already recognize.

This applies uniformly regardless of who created the customer record —
an agent who just added a new contact sees the same masked number
everyone else at their level does, immediately after creation, not just
for pre-existing customers.

Nothing about this affects actually sending messages: the real number
stays in the database and is used server-side for the WhatsApp API call
itself. Masking only affects what's serialized back to the browser.
"""


def mask_phone_number(number: str) -> str:
    """
    Matches Safaricom's own M-Pesa transaction-masking convention
    (rolled out March 2026): keep the first 4 characters and the last 3
    digits, replace the middle with exactly three asterisks — not
    proportional to how many digits are actually hidden, matching their
    exact visual convention (e.g. 0722000712 -> 0722***712) rather than
    a variable-length mask. Applied here to E.164-formatted numbers
    (+254712345678 -> +254***678), same structure, since that's the
    format actually stored — the fixed +country-code prefix serves the
    same "first 4 visible" role Safaricom's local-format examples show.
    """
    if not number:
        return number

    visible_prefix_len = 4  # e.g. "+254"
    visible_suffix_len = 3  # last 3 digits — enough to tell similar numbers apart

    if len(number) <= visible_prefix_len + visible_suffix_len:
        return "*" * len(number)

    prefix = number[:visible_prefix_len]
    suffix = number[-visible_suffix_len:]
    return f"{prefix}***{suffix}"


def user_can_see_full_number(user) -> bool:
    """Deliberately strict: Super Admin only, not Admin or Manager —
    matches the explicit requirement this was built against, not the
    looser 'admin-tier-and-above' pattern used elsewhere in this app."""
    if not user or not getattr(user, "is_authenticated", False):
        return False
    from apps.accounts.models import Role

    return bool(user.is_superuser or user.role == Role.SUPER_ADMIN)


def visible_number(number: str, request) -> str:
    """Convenience wrapper for serializer method fields: pass the raw
    number and the request, get back whichever version this requester
    is allowed to see."""
    user = getattr(request, "user", None) if request else None
    if user_can_see_full_number(user):
        return number
    return mask_phone_number(number)

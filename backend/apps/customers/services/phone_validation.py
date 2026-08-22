"""
Phone number format validation.

Important honesty note: Meta's official WhatsApp Cloud API does not
expose a way to check whether an arbitrary number is actually registered
on WhatsApp — that lookup was removed from the official API specifically
to prevent number-harvesting abuse. Third-party services that offer it
do so via unofficial, reverse-engineered WhatsApp access, which this
project deliberately avoids (see the spec's "no unofficial WhatsApp
APIs" requirement).

What we CAN honestly verify up front is whether a number is a
well-formed, plausible phone number (correct length/structure for its
country). That catches the overwhelming majority of real mistakes —
typos, missing digits, wrong country code — even though it can't
confirm WhatsApp registration itself. The authoritative "is this number
reachable on WhatsApp" signal only exists once we actually try to send
to it (see apps.conversations services — send failures are surfaced
back to the UI immediately).
"""
from __future__ import annotations

import phonenumbers
from phonenumbers import NumberParseException


def validate_phone_format(raw_number: str, default_region: str = "KE") -> dict:
    raw_number = (raw_number or "").strip()
    if not raw_number:
        return {"valid": False, "reason": "Enter a phone number."}

    try:
        parsed = phonenumbers.parse(raw_number, default_region)
    except NumberParseException:
        return {"valid": False, "reason": "This doesn't look like a valid phone number."}

    if not phonenumbers.is_valid_number(parsed):
        return {"valid": False, "reason": "This doesn't look like a valid phone number."}

    region = phonenumbers.region_code_for_number(parsed)
    country_name = _REGION_NAMES.get(region, region or "")

    return {
        "valid": True,
        "formatted": phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164),
        "country": country_name,
    }


# Small, deliberately short lookup for the countries Modotech is likely to
# actually see — falls back to the raw region code for anything else
# rather than pulling in a full country-name dependency for this.
_REGION_NAMES = {
    "KE": "Kenya", "UG": "Uganda", "TZ": "Tanzania", "RW": "Rwanda",
    "US": "United States", "GB": "United Kingdom", "NG": "Nigeria",
    "ZA": "South Africa", "IN": "India",
}

"""
Identifies which broadcast send failures are specifically "this number
isn't on WhatsApp" versus other failure reasons (rate limits, template
issues, expired tokens, etc.) — so a manager reviewing a failed
broadcast can pull out the contacts actually worth removing from future
sends, rather than a generic failure dump.

Matches on Meta's own documented error codes for this case (131047
"number not registered on WhatsApp", 131026 "recipient has an invalid
number or does not use WhatsApp"), plus a text-pattern fallback since
the exact wording can vary by provider (360dialog vs. direct Meta) and
error codes aren't always present in what gets stored. This is a
"likely" classification, not a certainty — stated as such wherever it's
surfaced, since there's no way to be fully sure without WhatsApp's own
confirmation.
"""
import re

_NOT_ON_WHATSAPP_CODES = {"131047", "131026"}
_NOT_ON_WHATSAPP_PATTERNS = [
    re.compile(r"not registered on whatsapp", re.IGNORECASE),
    re.compile(r"does not use whatsapp", re.IGNORECASE),
    re.compile(r"not a whatsapp (phone )?number", re.IGNORECASE),
    re.compile(r"recipient.*(invalid number|not.*whatsapp)", re.IGNORECASE),
]


def is_likely_not_on_whatsapp(error_text: str) -> bool:
    if not error_text:
        return False
    if any(code in error_text for code in _NOT_ON_WHATSAPP_CODES):
        return True
    return any(pattern.search(error_text) for pattern in _NOT_ON_WHATSAPP_PATTERNS)

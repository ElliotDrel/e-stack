"""Party specs: who is flying, and how many of them occupy a seat.

One module rather than duplicated parsing, because fetch and load have to agree
exactly: fetch writes the party into the filename, load reads it back out. A
drift between the two silently misprices every row.

Spec grammar is a run of count+letter terms, order-insensitive and
case-insensitive:

    1a      one adult
    2a      two adults
    2a3c    two adults, three children
    1a1l    one adult, one lap infant

    a  adults
    c  children
    i  infants in their own seat
    l  infants on a lap

A bare number means adults, so "2" and "2a" are the same thing. A party with no
adults is a hard error rather than a silent zero -- airlines do not sell one.
"""
import re

PARTY_FIELDS = (
    ("a", "adults"),
    ("c", "children"),
    ("i", "infants_in_seat"),
    ("l", "infants_on_lap"),
)
_LETTER_TO_FIELD = dict(PARTY_FIELDS)
_TERM_RE = re.compile(r"(\d+)\s*([acil])", re.IGNORECASE)
_SPEC_RE = re.compile(r"(?:\d+[acil])+")
EMPTY = {name: 0 for _, name in PARTY_FIELDS}


def parse_party(spec) -> dict:
    """Accept a spec string ("2a1c"), a bare number, or a dict already in party
    shape, and return the canonical dict. Raises ValueError on a party with no
    adults or on anything that isn't a spec."""
    if isinstance(spec, dict):
        party = {name: int(spec.get(name, 0) or 0) for _, name in PARTY_FIELDS}
        if party["adults"] < 1:
            raise ValueError(f"party {spec!r} has no adults")
        return party
    raw = str(spec or "").strip().lower().replace(" ", "")
    if not raw:
        raise ValueError("empty party spec")
    if raw.isdigit():
        raw += "a"
    if not _SPEC_RE.fullmatch(raw):
        raise ValueError(f"bad party spec {spec!r} (expected e.g. 1a, 2a, 2a1c)")
    party = dict(EMPTY)
    for count, letter in _TERM_RE.findall(raw):
        party[_LETTER_TO_FIELD[letter.lower()]] += int(count)
    if party["adults"] < 1:
        raise ValueError(f"party {spec!r} has no adults")
    return party


def party_token(party: dict) -> str:
    """Canonical spec string, for filenames. Zero-count groups are dropped."""
    return "".join(f"{party[name]}{letter}" for letter, name in PARTY_FIELDS
                   if party.get(name))


def party_seats(party: dict) -> int:
    """Seats occupied. A lap infant is a passenger but not a seat, so it never
    dilutes a per-seat price and never buys a shuttle ticket."""
    return party["adults"] + party["children"] + party["infants_in_seat"]


def party_label(party: dict) -> str:
    """Human phrasing: "2 adults + 1 child"."""
    names = {
        "adults": ("adult", "adults"),
        "children": ("child", "children"),
        "infants_in_seat": ("infant in a seat", "infants in seats"),
        "infants_on_lap": ("lap infant", "lap infants"),
    }
    parts = []
    for _, field in PARTY_FIELDS:
        n = party.get(field, 0)
        if n:
            one, many = names[field]
            parts.append(f"{n} {one if n == 1 else many}")
    return " + ".join(parts) or "nobody"

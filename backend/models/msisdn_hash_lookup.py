"""
MSISDN hash lookup for decoding Safaricom C2B hashed phone numbers.

Safaricom hashes MSISDN with SHA-256 for data minimization. We build our own
lookup by hashing plain phones when we receive them (e.g. from STK Push)
and storing hash -> phone. When C2B sends a hash, we look it up.
"""
import hashlib
from datetime import datetime

from beanie import Document, Indexed
from pydantic import Field


def _normalize_phone(phone: str) -> str:
    """Normalize to 254XXXXXXXXX format."""
    if not phone:
        return ""
    digits = "".join(c for c in str(phone).strip() if c.isdigit())
    if digits.startswith("0") and len(digits) == 10:
        return "254" + digits[1:]
    if digits.startswith("254") and len(digits) == 12:
        return digits
    if len(digits) >= 9:
        return "254" + digits[-9:]  # assume Kenyan
    return digits


def hash_msisdn(phone: str) -> str:
    """
    Hash phone number the same way Safaricom does (SHA-256).
    Uses normalized 254 format. Returns lowercase hex.
    """
    normalized = _normalize_phone(phone)
    if not normalized:
        return ""
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest().lower()


def safaricom_msisdn_preimage_variants(normalized_254: str) -> list[str]:
    """
    Candidate strings that Safaricom may SHA-256 for C2B MSISDN (differs by channel).
    When we learn a plain phone (e.g. STK), we index all variants so C2B hashes resolve.
    """
    n = (normalized_254 or "").strip()
    if not n:
        return []
    base: list[str] = [n]
    if n.startswith("254") and len(n) >= 12:
        tail9 = n[3:12]
        if len(tail9) == 9:
            base.append(tail9)
            base.append("0" + tail9)
    with_plus = ["+" + b for b in base if not b.startswith("+")]
    merged = base + with_plus
    seen: set[str] = set()
    out: list[str] = []
    for x in merged:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


def sha256_lower_hex(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest().lower()


class MsisdnHashLookup(Document):
    """Hash -> phone mapping for decoding C2B hashed MSISDN."""
    sha256_hash: Indexed(str, unique=True)
    phone: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "msisdn_hash_lookups"
        indexes = ["sha256_hash"]

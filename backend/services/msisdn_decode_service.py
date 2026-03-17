"""
Decode hashed M-Pesa MSISDN (phone numbers) from C2B notifications.

Supports your own decode API matching mpesa-hash-decoder interface:
  POST { hashedPhone, algo: "Sha256" } -> { success, data: { phone, sha256Hash } }

Configure DECODE_MSISDN_URL to your self-hosted API endpoint.
"""
import logging
import re
from typing import Optional

import httpx

from backend.config.config import get_settings
from backend.models.msisdn_hash_lookup import MsisdnHashLookup
from backend.models.system_setting import SystemSetting

logger = logging.getLogger(__name__)

# Kenyan phone pattern: 254XXXXXXXXX (12 digits)
_FULL_PHONE_RE = re.compile(r"^254\d{9}$")
_MASKED_OR_HASH_RE = re.compile(r"[\*#]|^[a-fA-F0-9]{64}$")  # SHA256 = 64 hex chars


def looks_like_plain_phone(value: str) -> bool:
    """Return True if value appears to be a full, unmasked phone number."""
    if not value or len(value) < 10:
        return False
    digits = re.sub(r"\D", "", value)
    return len(digits) >= 10 and not _MASKED_OR_HASH_RE.search(value)


def looks_like_hash(value: str) -> bool:
    """Return True if value looks like a SHA-256 hash (64 hex chars)."""
    if not value or len(value) != 64:
        return False
    return bool(re.match(r"^[a-fA-F0-9]{64}$", value.strip()))


async def add_to_lookup(phone: str) -> None:
    """
    Add a plain phone to our hash lookup. Call when we receive a transaction
    with plain phone (STK, or C2B before hashing was enforced).
    """
    from backend.models.msisdn_hash_lookup import hash_msisdn

    if not phone or not looks_like_plain_phone(phone):
        return
    h = hash_msisdn(phone)
    if not h:
        return
    existing = await MsisdnHashLookup.find_one({"sha256_hash": h})
    if existing:
        return
    try:
        lookup = MsisdnHashLookup(sha256_hash=h, phone=phone.strip())
        await lookup.insert()
        logger.debug("Added MSISDN lookup for %s", phone[:7] + "***")
    except Exception:
        pass  # Duplicate hash — ignore


async def _get_decode_url() -> str:
    """Get effective decode URL from env or DB."""
    env = get_settings()
    url = getattr(env, "MPESA_DECODE_MSISDN_URL", None) or ""
    s = await SystemSetting.find_one({"key": "mpesa_decode_msisdn_url"})
    if s and s.value and str(s.value).strip():
        url = str(s.value).strip()
    return url


async def decode_msisdn(hashed_value: str) -> Optional[str]:
    """
    Decode a hashed MSISDN to the actual phone number.

    - If value looks like a plain phone (254XXXXXXXXX), return as-is.
    - If DECODE_MSISDN_URL is configured: call your API (mpesa-hash-decoder format).
    - Else: fall back to local lookup table.
    """
    if not hashed_value or not str(hashed_value).strip():
        return None

    value = str(hashed_value).strip()

    # Already a full phone? Return as-is
    if looks_like_plain_phone(value):
        return value

    # 1. Try your own decode API (mpesa-hash-decoder format)
    url = await _get_decode_url()
    if url:
        try:
            payload = {"hashedPhone": value, "algo": "Sha256"}
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(url, json=payload, headers={"Content-Type": "application/json"})

            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, dict) and data.get("success"):
                    inner = data.get("data") or {}
                    phone = inner.get("phone") or inner.get("msisdn")
                    if phone and str(phone).strip():
                        return str(phone).strip()
        except Exception as e:
            logger.warning("Decode API failed for %s: %s", value[:20], e)

    # 2. Fall back to local lookup
    norm = value.lower().strip()
    if len(norm) == 64 and all(c in "0123456789abcdef" for c in norm):
        lookup = await MsisdnHashLookup.find_one({"sha256_hash": norm})
        if lookup:
            return lookup.phone

    return None

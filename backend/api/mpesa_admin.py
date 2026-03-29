"""
M-Pesa admin API: manage config, test OAuth, register C2B URLs.
Config stored in DB overrides .env when set.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth.dependencies import require_admin, require_admin_read
from backend.models.system_setting import SystemSetting
from backend.services import config_service
from backend.services.mpesa_service import get_access_token, register_c2b_urls
from backend.services.msisdn_decode_service import decode_msisdn

router = APIRouter(prefix="/api/admin/mpesa", tags=["mpesa-admin"])

MPESA_KEYS = config_service.MPESA_KEYS


def _mask_secret(val: Optional[str], show_last: int = 4) -> str:
    if not val or len(val) <= show_last:
        return "••••" if val else ""
    return "•" * (len(val) - show_last) + val[-show_last:]


class MpesaConfigUpdate(BaseModel):
    mpesa_consumer_key: Optional[str] = None
    mpesa_consumer_secret: Optional[str] = None
    mpesa_business_short_code: Optional[str] = None
    mpesa_till_display_number: Optional[str] = None
    mpesa_passkey: Optional[str] = None
    mpesa_base_url: Optional[str] = None
    mpesa_account_type: Optional[str] = None
    mpesa_callback_url: Optional[str] = None
    mpesa_c2b_confirmation_url: Optional[str] = None
    mpesa_c2b_validation_url: Optional[str] = None
    mpesa_decode_msisdn_url: Optional[str] = None


@router.get("/status")
async def mpesa_status(_=Depends(require_admin_read)):
    """Check if M-Pesa is configured and active (has credentials + short code)."""
    config = await config_service.get_mpesa_config()
    has_creds = bool(config.get("mpesa_consumer_key") and config.get("mpesa_consumer_secret"))
    has_shortcode = bool(config.get("mpesa_business_short_code"))
    active = has_creds and has_shortcode
    return {
        "active": active,
        "short_code": config.get("mpesa_business_short_code") or None,
        "till_display_number": (config.get("mpesa_till_display_number") or "").strip() or None,
        "account_type": config.get("mpesa_account_type") or "till",
    }


@router.get("/config")
async def get_mpesa_config(_=Depends(require_admin_read)):
    """Get current M-Pesa config. Secrets are masked in response."""
    config = await config_service.get_mpesa_config()
    return {
        "config": {
            "mpesa_consumer_key": _mask_secret(config.get("mpesa_consumer_key"), 6),
            "mpesa_consumer_secret": _mask_secret(config.get("mpesa_consumer_secret"), 6),
            "mpesa_business_short_code": config.get("mpesa_business_short_code") or "",
            "mpesa_till_display_number": config.get("mpesa_till_display_number") or "",
            "mpesa_passkey": _mask_secret(config.get("mpesa_passkey"), 8),
            "mpesa_base_url": config.get("mpesa_base_url") or "https://api.safaricom.co.ke",
            "mpesa_account_type": config.get("mpesa_account_type") or "till",
            "mpesa_callback_url": config.get("mpesa_callback_url") or "",
            "mpesa_c2b_confirmation_url": config.get("mpesa_c2b_confirmation_url") or "",
            "mpesa_c2b_validation_url": config.get("mpesa_c2b_validation_url") or "",
            "mpesa_decode_msisdn_url": config.get("mpesa_decode_msisdn_url") or "",
        },
        "source": "db_overrides_env",
    }


@router.put("/config")
async def update_mpesa_config(body: MpesaConfigUpdate, _=Depends(require_admin)):
    """Update M-Pesa config in database. Empty values are ignored (keeps current)."""
    updates = {k: v for k, v in body.model_dump(exclude_none=True).items() if v and str(v).strip()}
    for key, value in updates.items():
        if key not in MPESA_KEYS:
            continue
        value_str = str(value).strip() if value else ""
        existing = await SystemSetting.find_one({"key": key})
        if existing:
            await existing.set({"value": value_str, "updated_at": datetime.utcnow()})
        else:
            setting = SystemSetting(key=key, value=value_str, category="mpesa")
            await setting.insert()
    config_service.invalidate_cache()
    return {"detail": "M-Pesa config updated"}


@router.post("/test-oauth")
async def test_oauth(_=Depends(require_admin)):
    """Test OAuth token retrieval from M-Pesa Daraja."""
    token = await get_access_token()
    if token:
        return {"success": True, "message": "OAuth token retrieved successfully"}
    return {"success": False, "message": "Failed to get OAuth token. Check credentials and base URL."}


@router.post("/register-c2b")
async def register_c2b(_=Depends(require_admin)):
    """Register C2B confirmation and validation URLs with M-Pesa Daraja."""
    result = await register_c2b_urls()
    if "error" in result:
        raise HTTPException(status_code=503, detail=result["error"])
    if result.get("errorCode") or result.get("errorMessage"):
        raise HTTPException(
            status_code=503,
            detail=result.get("errorMessage") or f"Error {result.get('errorCode', '')}",
        )
    if "ResponseDescription" in result:
        return {"success": True, "message": result.get("ResponseDescription", "C2B URLs registered")}
    return {"success": True, "message": "C2B URLs registered", "response": result}


class DecodeMsisdnRequest(BaseModel):
    hash: str


class AddMsisdnLookupRequest(BaseModel):
    phone: str


@router.post("/add-msisdn-lookup")
async def admin_add_msisdn_lookup(body: AddMsisdnLookupRequest, _=Depends(require_admin)):
    """
    Manually add a phone to our hash lookup. Use when you have a phone from
    another source and want to enable decode for future C2B hashes.
    """
    from backend.services.msisdn_decode_service import add_to_lookup, looks_like_plain_phone
    if not looks_like_plain_phone(body.phone):
        raise HTTPException(status_code=400, detail="Invalid phone format. Use 254XXXXXXXXX.")
    await add_to_lookup(body.phone)
    return {"detail": "Phone added to lookup"}


@router.post("/decode-msisdn")
async def admin_decode_msisdn(body: DecodeMsisdnRequest, _=Depends(require_admin)):
    """
    Decode a hashed M-Pesa MSISDN using our own lookup table.
    Lookup is populated from STK Push and C2B when we receive plain phones.
    """
    phone = await decode_msisdn(body.hash)
    return {"hash": body.hash, "phone": phone}

from datetime import datetime
from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth.dependencies import get_current_user, require_admin, require_admin_read
from backend.models.notification import NotificationPreferences
from backend.models.sms_config import SMSConfiguration
from backend.models.smtp_config import SMTPConfiguration
from backend.models.user import User

router = APIRouter(tags=["notifications"])


# --- SMTP ---
class SMTPCreate(BaseModel):
    name: str
    host: str
    port: int = 587
    username: str
    password: str
    use_tls: bool = True
    from_email: str
    from_name: Optional[str] = None
    is_active: bool = True


@router.post("/api/admin/smtp-configurations")
async def create_smtp(body: SMTPCreate, _=Depends(require_admin)):
    config = SMTPConfiguration(**body.dict())
    await config.insert()
    return {"id": str(config.id), **config.dict()}


@router.get("/api/admin/smtp-configurations")
async def list_smtp(_=Depends(require_admin_read)):
    configs = await SMTPConfiguration.find_all().to_list()
    return [{"id": str(c.id), **c.dict()} for c in configs]


@router.put("/api/admin/smtp-configurations/{config_id}")
async def update_smtp(config_id: PydanticObjectId, body: SMTPCreate, _=Depends(require_admin)):
    config = await SMTPConfiguration.get(config_id)
    if not config:
        raise HTTPException(status_code=404, detail="SMTP config not found")
    await config.set({**body.dict(), "updated_at": datetime.utcnow()})
    return {"id": str(config.id), **config.dict()}


# --- SMS ---
class SMSCreate(BaseModel):
    name: str
    provider_type: str
    api_key: str
    api_secret: Optional[str] = None
    sender_id: Optional[str] = None
    is_active: bool = True


@router.post("/api/admin/sms-configurations")
async def create_sms(body: SMSCreate, _=Depends(require_admin)):
    config = SMSConfiguration(**body.dict())
    await config.insert()
    return {"id": str(config.id), **config.dict()}


@router.get("/api/admin/sms-configurations")
async def list_sms(_=Depends(require_admin_read)):
    configs = await SMSConfiguration.find_all().to_list()
    return [{"id": str(c.id), **c.dict()} for c in configs]


@router.put("/api/admin/sms-configurations/{config_id}")
async def update_sms(config_id: PydanticObjectId, body: SMSCreate, _=Depends(require_admin)):
    config = await SMSConfiguration.get(config_id)
    if not config:
        raise HTTPException(status_code=404, detail="SMS config not found")
    await config.set({**body.dict(), "updated_at": datetime.utcnow()})
    return {"id": str(config.id), **config.dict()}


# --- Notification Preferences ---
class PrefsUpdate(BaseModel):
    email_enabled: Optional[bool] = None
    sms_enabled: Optional[bool] = None
    email_draw_results: Optional[bool] = None
    email_promotion_updates: Optional[bool] = None
    sms_draw_results: Optional[bool] = None


@router.get("/api/notification-preferences")
async def get_prefs(current_user: User = Depends(get_current_user)):
    prefs = await NotificationPreferences.find_one({"user_id": current_user.id})
    if not prefs:
        prefs = NotificationPreferences(user_id=current_user.id)
        await prefs.insert()
    return {"id": str(prefs.id), **prefs.dict()}


@router.put("/api/notification-preferences")
async def update_prefs(body: PrefsUpdate, current_user: User = Depends(get_current_user)):
    prefs = await NotificationPreferences.find_one({"user_id": current_user.id})
    if not prefs:
        prefs = NotificationPreferences(user_id=current_user.id)
        await prefs.insert()
    update_data = {k: v for k, v in body.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    await prefs.set(update_data)
    return {"id": str(prefs.id), **prefs.dict()}

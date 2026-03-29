from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth.dependencies import require_admin, require_admin_read
from backend.models.system_setting import SystemSetting
from backend.services import config_service

router = APIRouter(prefix="/api/admin", tags=["settings"])

SETTING_DEFINITIONS = [
    {
        "key": "draw_cooldown_minutes",
        "description": "Minimum minutes between draws for same promotion",
        "value_type": "string",
        "category": "general",
        "default": "5",
    },
    {
        "key": "min_transactions_per_draw",
        "description": "Minimum eligible transactions required to execute a draw",
        "value_type": "string",
        "category": "general",
        "default": "1",
    },
    {
        "key": "max_draws_per_promotion",
        "description": "Maximum draws allowed per promotion (0 = unlimited)",
        "value_type": "string",
        "category": "general",
        "default": "0",
    },
    {
        "key": "default_payout_amount",
        "description": "Default payout amount in cents",
        "value_type": "string",
        "category": "payment",
        "default": "0",
    },
]


class SettingCreate(BaseModel):
    key: str
    value: Optional[str] = None
    structured_value: Optional[Dict[str, Any]] = None
    value_type: str = "string"
    description: Optional[str] = None
    category: Optional[str] = None


class SettingUpdate(BaseModel):
    value: Optional[str] = None
    structured_value: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    category: Optional[str] = None


@router.get("/settings")
async def list_settings(_=Depends(require_admin_read)):
    settings = await SystemSetting.find_all().to_list()
    return [{"id": str(s.id), **s.dict()} for s in settings]


@router.post("/settings")
async def create_setting(body: SettingCreate, _=Depends(require_admin)):
    if await SystemSetting.find_one({"key": body.key}):
        raise HTTPException(status_code=400, detail="Setting key already exists")
    setting = SystemSetting(**body.dict())
    await setting.insert()
    config_service.invalidate_cache()
    return {"id": str(setting.id), **setting.dict()}


@router.put("/settings/{key}")
async def update_setting(key: str, body: SettingUpdate, _=Depends(require_admin)):
    setting = await SystemSetting.find_one({"key": key})
    if not setting:
        raise HTTPException(status_code=404, detail="Setting not found")
    update_data = {k: v for k, v in body.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    await setting.set(update_data)
    config_service.invalidate_cache()
    return {"id": str(setting.id), **setting.dict()}


@router.get("/setting-types")
async def setting_types(_=Depends(require_admin_read)):
    return SETTING_DEFINITIONS

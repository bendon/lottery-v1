from datetime import datetime
from typing import Any, Dict, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth.dependencies import require_admin, require_admin_read
from backend.models.payment_provider import PaymentProvider

router = APIRouter(prefix="/api/admin/payment-providers", tags=["payment-providers"])


class ProviderCreate(BaseModel):
    name: str
    provider_type: str
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    webhook_secret: Optional[str] = None
    is_active: bool = True
    settings: Dict[str, Any] = {}


class ProviderUpdate(BaseModel):
    api_key: Optional[str] = None
    api_secret: Optional[str] = None
    webhook_secret: Optional[str] = None
    is_active: Optional[bool] = None
    settings: Optional[Dict[str, Any]] = None


@router.post("")
async def create_provider(body: ProviderCreate, _=Depends(require_admin)):
    if await PaymentProvider.find_one({"name": body.name}):
        raise HTTPException(status_code=400, detail="Provider name already exists")
    provider = PaymentProvider(**body.dict())
    await provider.insert()
    return {"id": str(provider.id), **provider.dict()}


@router.get("")
async def list_providers(_=Depends(require_admin_read)):
    providers = await PaymentProvider.find_all().to_list()
    return [{"id": str(p.id), **p.dict()} for p in providers]


@router.put("/{provider_id}")
async def update_provider(provider_id: PydanticObjectId, body: ProviderUpdate, _=Depends(require_admin)):
    provider = await PaymentProvider.get(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    update_data = {k: v for k, v in body.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    await provider.set(update_data)
    return {"id": str(provider.id), **provider.dict()}

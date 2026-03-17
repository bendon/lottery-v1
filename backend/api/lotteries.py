from datetime import datetime
from typing import Any, Dict, List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth.dependencies import get_current_user, require_admin
from backend.models.lottery import Lottery, DEMO_PAYBILL
from backend.services import config_service

router = APIRouter(prefix="/api/admin/lotteries", tags=["lotteries"])


class LotteryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    lottery_type: str = "random_pick"
    is_demo: bool = False  # Demo uses demo paybill; Live requires M-Pesa active
    settings: Dict[str, Any] = {}
    payout_amount: Optional[int] = None
    payout_percentage: Optional[float] = None
    is_active: bool = True


class LotteryUpdate(BaseModel):
    description: Optional[str] = None
    lottery_type: Optional[str] = None
    settings: Optional[Dict[str, Any]] = None
    payout_amount: Optional[int] = None
    payout_percentage: Optional[float] = None
    is_active: Optional[bool] = None


@router.post("")
async def create_lottery(body: LotteryCreate, current_user=Depends(require_admin)):
    if await Lottery.find_one({"name": body.name}):
        raise HTTPException(status_code=400, detail="Lottery name already exists")

    if body.is_demo:
        # Demo lottery: use demo paybill for showcase
        lottery = Lottery(
            name=body.name,
            description=body.description,
            lottery_type=body.lottery_type,
            is_demo=True,
            paybill_number=DEMO_PAYBILL,
            payment_types=["paybill"],
            settings=body.settings or {},
            payout_amount=body.payout_amount,
            payout_percentage=body.payout_percentage,
            is_active=body.is_active,
            created_by=current_user.id,
        )
    else:
        # Live lottery: requires M-Pesa configured, uses global config
        mpesa = await config_service.get_mpesa_config()
        if not mpesa.get("mpesa_consumer_key") or not mpesa.get("mpesa_business_short_code"):
            raise HTTPException(
                status_code=400,
                detail="M-Pesa must be configured in Settings before creating a live lottery. Use Demo mode for showcase.",
            )
        account_type = (mpesa.get("mpesa_account_type") or "paybill").lower()
        short_code = mpesa.get("mpesa_business_short_code") or ""
        lottery = Lottery(
            name=body.name,
            description=body.description,
            lottery_type=body.lottery_type,
            is_demo=False,
            till_number=short_code if account_type == "till" else None,
            paybill_number=short_code if account_type == "paybill" else None,
            payment_types=[account_type, "stk_push"],
            settings=body.settings or {},
            payout_amount=body.payout_amount,
            payout_percentage=body.payout_percentage,
            is_active=body.is_active,
            created_by=current_user.id,
        )
    await lottery.insert()
    return {"id": str(lottery.id), **lottery.model_dump()}


@router.get("")
async def list_lotteries(_=Depends(require_admin)):
    lotteries = await Lottery.find_all().to_list()
    return [{"id": str(l.id), **l.dict()} for l in lotteries]


@router.get("/{lottery_id}")
async def get_lottery(lottery_id: PydanticObjectId, _=Depends(require_admin)):
    lottery = await Lottery.get(lottery_id)
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")
    return {"id": str(lottery.id), **lottery.dict()}


@router.put("/{lottery_id}")
async def update_lottery(lottery_id: PydanticObjectId, body: LotteryUpdate, _=Depends(require_admin)):
    lottery = await Lottery.get(lottery_id)
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")
    update_data = {k: v for k, v in body.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow()
    await lottery.set(update_data)
    return {"id": str(lottery.id), **lottery.dict()}


@router.delete("/{lottery_id}")
async def delete_lottery(lottery_id: PydanticObjectId, _=Depends(require_admin)):
    lottery = await Lottery.get(lottery_id)
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")
    await lottery.delete()
    return {"detail": "Lottery deleted"}

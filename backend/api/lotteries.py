from datetime import datetime
from typing import Any, Dict, List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth.dependencies import get_current_user, require_admin
from backend.models.lottery import Lottery

router = APIRouter(prefix="/api/admin/lotteries", tags=["lotteries"])


class LotteryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    lottery_type: str = "random_pick"
    till_number: Optional[str] = None
    paybill_number: Optional[str] = None
    api_integration_id: Optional[str] = None
    payment_types: List[str] = ["till"]
    settings: Dict[str, Any] = {}
    payout_amount: Optional[int] = None
    payout_percentage: Optional[float] = None
    is_active: bool = True


class LotteryUpdate(BaseModel):
    description: Optional[str] = None
    lottery_type: Optional[str] = None
    till_number: Optional[str] = None
    paybill_number: Optional[str] = None
    api_integration_id: Optional[str] = None
    payment_types: Optional[List[str]] = None
    settings: Optional[Dict[str, Any]] = None
    payout_amount: Optional[int] = None
    payout_percentage: Optional[float] = None
    is_active: Optional[bool] = None


@router.post("")
async def create_lottery(body: LotteryCreate, current_user=Depends(require_admin)):
    if await Lottery.find_one({"name": body.name}):
        raise HTTPException(status_code=400, detail="Lottery name already exists")
    lottery = Lottery(**body.dict(), created_by=current_user.id)
    await lottery.insert()
    return {"id": str(lottery.id), **lottery.dict()}


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

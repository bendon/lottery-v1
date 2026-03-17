from datetime import datetime
from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth.dependencies import get_current_user, require_admin
from backend.models.promotion import Promotion
from backend.models.transaction import Transaction

router = APIRouter(tags=["promotions"])


class PromotionCreate(BaseModel):
    user_id: str
    lottery_id: str
    name: Optional[str] = None
    start_date: datetime
    end_date: datetime
    status: str = "active"


class PromotionUpdate(BaseModel):
    name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None


async def _deactivate_other_promotions(exclude_id: Optional[PydanticObjectId] = None):
    """Ensure only one promotion is active: set all others to completed."""
    query = {"status": "active"}
    if exclude_id:
        query["_id"] = {"$ne": exclude_id}
    others = await Promotion.find(query).to_list()
    for p in others:
        await p.set({"status": "completed"})


@router.post("/api/admin/promotions")
async def create_promotion(body: PromotionCreate, current_user=Depends(require_admin)):
    if body.status == "active":
        await _deactivate_other_promotions()
    promotion = Promotion(
        user_id=PydanticObjectId(body.user_id),
        lottery_id=PydanticObjectId(body.lottery_id),
        name=body.name,
        start_date=body.start_date,
        end_date=body.end_date,
        status=body.status,
        created_by=current_user.id,
    )
    await promotion.insert()
    return {"id": str(promotion.id), **promotion.dict()}


@router.get("/api/admin/promotions")
async def list_promotions(_=Depends(require_admin)):
    promotions = await Promotion.find_all().to_list()
    return [{"id": str(p.id), **p.dict()} for p in promotions]


@router.get("/api/admin/promotions/{promotion_id}")
async def get_promotion(promotion_id: PydanticObjectId, _=Depends(require_admin)):
    p = await Promotion.get(promotion_id)
    if not p:
        raise HTTPException(status_code=404, detail="Promotion not found")
    return {"id": str(p.id), **p.dict()}


@router.put("/api/admin/promotions/{promotion_id}")
async def update_promotion(promotion_id: PydanticObjectId, body: PromotionUpdate, _=Depends(require_admin)):
    p = await Promotion.get(promotion_id)
    if not p:
        raise HTTPException(status_code=404, detail="Promotion not found")
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates.get("status") == "active":
        await _deactivate_other_promotions(exclude_id=promotion_id)
    await p.set(updates)
    return {"id": str(p.id), **p.dict()}


@router.delete("/api/admin/promotions/{promotion_id}")
async def delete_promotion(promotion_id: PydanticObjectId, _=Depends(require_admin)):
    p = await Promotion.get(promotion_id)
    if not p:
        raise HTTPException(status_code=404, detail="Promotion not found")
    await p.delete()
    return {"detail": "Promotion deleted"}


@router.get("/api/promotions")
async def my_promotions(current_user=Depends(get_current_user)):
    """Presenter view: the single active promotion assigned to this user (only one active globally)."""
    active = await Promotion.find_one({"status": "active"})
    if not active or active.user_id != current_user.id:
        return []
    return [{"id": str(active.id), **active.dict()}]


def _mask_phone(phone: str) -> str:
    """254712345678 → 254*****78"""
    if not phone:
        return "—"
    phone = phone.strip()
    if len(phone) <= 4:
        return "***"
    return phone[:3] + "*" * (len(phone) - 5) + phone[-2:]


def _mask_name(name: str) -> str:
    """John Kamau → J*** K***"""
    if not name or not name.strip():
        return "—"
    return " ".join(
        (part[0] + "***") if part else "***"
        for part in name.strip().split()
    )


def _mask_txn(txn_number: str) -> str:
    """RXA1234F56 → RXA***F56"""
    if not txn_number:
        return "—"
    n = txn_number.strip()
    if len(n) <= 6:
        return n[:2] + "***"
    return n[:3] + "***" + n[-3:]


@router.get("/api/transactions")
async def presenter_transactions(current_user=Depends(get_current_user)):
    """
    Presenter view: masked transactions for the single active promotion only.
    Only transactions within the promotion's start_date..end_date are shown.
    PII (name, phone, full transaction number) is redacted.
    Admin sees all transactions via /api/admin/transactions.
    """
    active = await Promotion.find_one({"status": "active"})
    if not active or active.user_id != current_user.id:
        return []

    query = {
        "product_id": active.lottery_id,
        "payment_date": {"$gte": active.start_date, "$lte": active.end_date},
    }
    txns = (
        await Transaction.find(query)
        .sort("-payment_date")
        .limit(200)
        .to_list()
    )

    return [
        {
            "id": str(t.id),
            "transaction_number": _mask_txn(t.transaction_number),
            "payment_type": t.payment_type,
            "amount": t.amount,
            "payment_date": t.payment_date,
            "customer_name": _mask_name(t.customer_name or ""),
            "customer_phone": _mask_phone(t.customer_phone or ""),
            "product_id": str(t.product_id) if t.product_id else None,
        }
        for t in txns
    ]

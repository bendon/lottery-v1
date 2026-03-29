from datetime import datetime
from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.auth.dependencies import get_current_user, require_admin, require_admin_read
from backend.models.lottery import Lottery
from backend.models.promotion import Promotion
from backend.models.transaction import Transaction
from backend.services.lottery_payment_mode import lottery_uses_paybill_accounts

router = APIRouter(tags=["promotions"])


class PromotionCreate(BaseModel):
    user_id: str
    lottery_id: str
    name: Optional[str] = None
    account_number: Optional[str] = None  # Paybill account (BillRefNumber) — enables concurrent promotions
    start_date: datetime
    end_date: datetime
    status: str = "active"


class PromotionUpdate(BaseModel):
    name: Optional[str] = None
    account_number: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None


@router.post("/api/admin/promotions")
async def create_promotion(body: PromotionCreate, current_user=Depends(require_admin)):
    lottery = await Lottery.get(PydanticObjectId(body.lottery_id))
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")

    use_paybill = lottery_uses_paybill_accounts(lottery)
    account_number = None
    if use_paybill and body.account_number:
        account_number = body.account_number.strip() or None

    if body.status == "active" and not use_paybill:
        existing = await Promotion.find({"lottery_id": lottery.id, "status": "active"}).to_list()
        for o in existing:
            await o.set({"status": "completed"})

    promotion = Promotion(
        user_id=PydanticObjectId(body.user_id),
        lottery_id=lottery.id,
        name=body.name,
        account_number=account_number,
        start_date=body.start_date,
        end_date=body.end_date,
        status=body.status,
        created_by=current_user.id,
    )
    await promotion.insert()
    return {"id": str(promotion.id), **promotion.dict()}


@router.get("/api/admin/promotions")
async def list_promotions(_=Depends(require_admin_read)):
    promotions = await Promotion.find_all().to_list()
    return [{"id": str(p.id), **p.dict()} for p in promotions]


@router.get("/api/admin/promotions/{promotion_id}")
async def get_promotion(promotion_id: PydanticObjectId, _=Depends(require_admin_read)):
    p = await Promotion.get(promotion_id)
    if not p:
        raise HTTPException(status_code=404, detail="Promotion not found")
    return {"id": str(p.id), **p.dict()}


@router.put("/api/admin/promotions/{promotion_id}")
async def update_promotion(promotion_id: PydanticObjectId, body: PromotionUpdate, _=Depends(require_admin)):
    p = await Promotion.get(promotion_id)
    if not p:
        raise HTTPException(status_code=404, detail="Promotion not found")
    lottery = await Lottery.get(p.lottery_id)
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")

    use_paybill = lottery_uses_paybill_accounts(lottery)
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if "account_number" in updates:
        if not use_paybill:
            updates["account_number"] = None
        elif updates["account_number"] is not None:
            updates["account_number"] = updates["account_number"].strip() or None

    merged_status = updates.get("status", p.status)
    if merged_status == "active" and not use_paybill:
        others = await Promotion.find(
            {"lottery_id": p.lottery_id, "status": "active", "_id": {"$ne": p.id}}
        ).to_list()
        for o in others:
            await o.set({"status": "completed"})

    await p.set(updates)
    fresh = await Promotion.get(promotion_id)
    if not fresh:
        raise HTTPException(status_code=404, detail="Promotion not found")
    return {"id": str(fresh.id), **fresh.dict()}


@router.delete("/api/admin/promotions/{promotion_id}")
async def delete_promotion(promotion_id: PydanticObjectId, _=Depends(require_admin)):
    p = await Promotion.get(promotion_id)
    if not p:
        raise HTTPException(status_code=404, detail="Promotion not found")
    await p.delete()
    return {"detail": "Promotion deleted"}


@router.get("/api/promotions")
async def my_promotions(current_user=Depends(get_current_user)):
    """Presenter view: active promotions for this user (multiple for Paybill; at most one per Till lottery)."""
    promotions = await Promotion.find(
        {"user_id": current_user.id, "status": "active"}
    ).to_list()
    return [{"id": str(p.id), **p.dict()} for p in promotions]


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
async def presenter_transactions(
    current_user=Depends(get_current_user),
    promotion_id: Optional[str] = Query(None),
):
    """
    Presenter view: masked transactions for user's promotions.
    Optional promotion_id to filter by one promotion.
    """
    my_promos = await Promotion.find(
        {"user_id": current_user.id, "status": "active"}
    ).to_list()
    if not my_promos:
        return []

    if promotion_id:
        promo = next((p for p in my_promos if str(p.id) == promotion_id), None)
        if not promo:
            return []
        promos = [promo]
    else:
        promos = my_promos

    lottery_ids = list({p.lottery_id for p in promos})
    lotteries = {l.id: l for l in await Lottery.find({"_id": {"$in": lottery_ids}}).to_list()}

    conditions = []
    for p in promos:
        lottery = lotteries.get(p.lottery_id)
        date_range = {"$gte": p.start_date, "$lte": p.end_date}
        if lottery and lottery_uses_paybill_accounts(lottery) and p.account_number:
            conditions.append({
                "$and": [
                    {"$or": [
                        {"promotion_id": p.id},
                        {"product_id": p.lottery_id, "bill_ref_number": p.account_number},
                    ]},
                    {"payment_date": date_range},
                ],
            })
        else:
            conditions.append({
                "$and": [
                    {"promotion_id": p.id},
                    {"payment_date": date_range},
                ],
            })
    query = {"$or": conditions} if len(conditions) > 1 else conditions[0]

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

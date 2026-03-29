from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth.dependencies import get_current_user, is_staff_reader
from backend.models.draw import Draw
from backend.models.transaction import Transaction
from backend.models.user import User
from backend.services.draw_service import execute_draw, get_eligible_transactions
from backend.services.msisdn_decode_service import decode_msisdn
from backend.models.promotion import Promotion

router = APIRouter(prefix="/api/draws", tags=["draws"])


async def _build_winner_response(draw: Draw, current_user: User) -> Optional[dict]:
    """Build winner details with decoded phone for draw response."""
    txn = await Transaction.get(draw.transaction_id)
    if not txn:
        return None
    phone_raw = txn.customer_phone or ""
    phone_decoded = await decode_msisdn(phone_raw) if phone_raw else None
    phone_display = phone_decoded or phone_raw
    if not is_staff_reader(current_user.role) and phone_display:
        phone_display = phone_display[:3] + "*" * max(0, len(phone_display) - 5) + phone_display[-2:] if len(phone_display) > 4 else "***"
    return {
        "transaction_number": txn.transaction_number,
        "customer_name": txn.customer_name or "—",
        "customer_phone": phone_display or "—",
        "amount": txn.amount,
    }


class DrawCreate(BaseModel):
    promotion_id: str
    draw_type: str = "manual"
    notes: Optional[str] = None


@router.post("")
async def create_draw(body: DrawCreate, current_user: User = Depends(get_current_user)):
    if current_user.role == "auditor":
        raise HTTPException(status_code=403, detail="Auditor role cannot execute draws")

    promotion_id = PydanticObjectId(body.promotion_id)

    # Presenters can only draw on their own promotions
    if current_user.role not in ("admin",):
        promotion = await Promotion.get(promotion_id)
        if not promotion or str(promotion.user_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not your promotion")

    draw = await execute_draw(
        promotion_id=promotion_id,
        presenter_id=current_user.id if current_user.role == "presenter" else None,
        draw_type=body.draw_type,
        notes=body.notes,
    )
    # Include winner details with decoded phone when available
    winner_resp = await _build_winner_response(draw, current_user)
    return {"id": str(draw.id), **draw.dict(), "winner": winner_resp}


@router.get("")
async def list_draws(current_user: User = Depends(get_current_user)):
    if is_staff_reader(current_user.role):
        draws = await Draw.find_all().sort("-drawn_at").to_list()
    else:
        draws = await Draw.find({"presenter_id": current_user.id}).sort("-drawn_at").to_list()
    return [{"id": str(d.id), **d.dict()} for d in draws]


@router.get("/eligible-transactions/{promotion_id}")
async def eligible_transactions(
    promotion_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    promotion = await Promotion.get(promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion not found")

    if not is_staff_reader(current_user.role) and str(promotion.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your promotion")

    txns = await get_eligible_transactions(promotion)
    return [{"id": str(t.id), **t.dict()} for t in txns]


@router.get("/{draw_id}")
async def get_draw(draw_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    draw = await Draw.get(draw_id)
    if not draw:
        raise HTTPException(status_code=404, detail="Draw not found")
    if not is_staff_reader(current_user.role) and str(draw.presenter_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return {"id": str(draw.id), **draw.dict()}


@router.get("/{draw_id}/winner")
async def get_draw_winner(
    draw_id: PydanticObjectId,
    current_user: User = Depends(get_current_user),
):
    """
    Get winner details for a draw, including decoded phone.
    Admin sees full phone; presenter sees masked.
    """
    draw = await Draw.get(draw_id)
    if not draw:
        raise HTTPException(status_code=404, detail="Draw not found")
    if not is_staff_reader(current_user.role) and str(draw.presenter_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    txn = await Transaction.get(draw.transaction_id)
    if not txn:
        return {"draw_id": str(draw.id), "winning_number": draw.winning_number, "winner": None}

    phone_raw = txn.customer_phone or ""
    phone_decoded = await decode_msisdn(phone_raw) if phone_raw else None
    phone_display = phone_decoded or phone_raw

    # Mask for presenters
    if not is_staff_reader(current_user.role) and phone_display:
        if len(phone_display) <= 4:
            phone_display = "***"
        else:
            phone_display = phone_display[:3] + "*" * (len(phone_display) - 5) + phone_display[-2:]

    return {
        "draw_id": str(draw.id),
        "winning_number": draw.winning_number,
        "drawn_at": draw.drawn_at,
        "winner": {
            "transaction_number": txn.transaction_number,
            "customer_name": txn.customer_name or "—",
            "customer_phone": phone_display or "—",
            "amount": txn.amount,
            "payment_date": txn.payment_date,
        },
    }

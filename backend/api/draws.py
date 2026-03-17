from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth.dependencies import get_current_user, require_admin
from backend.models.draw import Draw
from backend.models.user import User
from backend.services.draw_service import execute_draw, get_eligible_transactions
from backend.models.promotion import Promotion

router = APIRouter(prefix="/api/draws", tags=["draws"])


class DrawCreate(BaseModel):
    promotion_id: str
    draw_type: str = "manual"
    notes: Optional[str] = None


@router.post("")
async def create_draw(body: DrawCreate, current_user: User = Depends(get_current_user)):
    promotion_id = PydanticObjectId(body.promotion_id)

    # Presenters can only draw on their own promotions
    if current_user.role != "admin":
        promotion = await Promotion.get(promotion_id)
        if not promotion or str(promotion.user_id) != str(current_user.id):
            raise HTTPException(status_code=403, detail="Not your promotion")

    draw = await execute_draw(
        promotion_id=promotion_id,
        presenter_id=current_user.id if current_user.role == "presenter" else None,
        draw_type=body.draw_type,
        notes=body.notes,
    )
    return {"id": str(draw.id), **draw.dict()}


@router.get("")
async def list_draws(current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
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

    if current_user.role != "admin" and str(promotion.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Not your promotion")

    txns = await get_eligible_transactions(promotion)
    return [{"id": str(t.id), **t.dict()} for t in txns]


@router.get("/{draw_id}")
async def get_draw(draw_id: PydanticObjectId, current_user: User = Depends(get_current_user)):
    draw = await Draw.get(draw_id)
    if not draw:
        raise HTTPException(status_code=404, detail="Draw not found")
    if current_user.role != "admin" and str(draw.presenter_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return {"id": str(draw.id), **draw.dict()}

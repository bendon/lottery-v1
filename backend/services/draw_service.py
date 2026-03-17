import random
from datetime import datetime
from typing import List, Optional

from beanie import PydanticObjectId
from fastapi import HTTPException, status

from backend.models.draw import Draw
from backend.models.lottery import Lottery
from backend.models.promotion import Promotion
from backend.models.transaction import Transaction
from backend.services import config_service


async def get_eligible_transactions(promotion: Promotion) -> List[Transaction]:
    """Return transactions eligible for a draw in the given promotion."""
    lottery = await Lottery.get(promotion.lottery_id)
    if not lottery:
        raise HTTPException(status_code=404, detail="Lottery not found")

    # Transactions already won in any promotion
    won_draws = await Draw.find_all().to_list()
    won_transaction_ids = {d.transaction_id for d in won_draws}

    # Build base query - promotion date range; filter by account_number when Paybill
    query: dict = {
        "product_type": "lottery",
        "product_id": lottery.id,
        "payment_type": {"$in": lottery.payment_types},
        "payment_date": {"$gte": promotion.start_date, "$lte": promotion.end_date},
    }
    if promotion.account_number:
        query["$or"] = [
            {"promotion_id": promotion.id},
            {"bill_ref_number": promotion.account_number},
        ]

    # Apply lottery-specific settings
    lottery_settings = lottery.settings or {}
    min_amount = lottery_settings.get("min_amount")
    if min_amount:
        query["amount"] = {"$gte": int(min_amount)}

    transactions = await Transaction.find(query).to_list()
    return [t for t in transactions if t.id not in won_transaction_ids]


async def validate_draw(promotion: Promotion, presenter_id: Optional[PydanticObjectId] = None):
    """Validate all pre-conditions before executing a draw."""
    now = datetime.utcnow()

    # 1. Promotion must be active
    if promotion.status != "active":
        raise HTTPException(status_code=400, detail="Promotion is not active")
    # Admin draws (presenter_id=None) bypass the time window restriction
    if presenter_id is not None and not (promotion.start_date <= now <= promotion.end_date):
        raise HTTPException(status_code=400, detail="Promotion is outside its active date range")

    # 2. Cooldown check
    cooldown = int(await config_service.get_setting("draw_cooldown_minutes", 5))
    if cooldown > 0:
        last_draw = (
            await Draw.find({"promotion_id": promotion.id})
            .sort("-drawn_at")
            .first_or_none()
        )
        if last_draw:
            delta = (now - last_draw.drawn_at).total_seconds() / 60
            if delta < cooldown:
                remaining = round(cooldown - delta, 1)
                raise HTTPException(
                    status_code=400,
                    detail=f"Cooldown active. Wait {remaining} more minutes.",
                )

    # 3. Max draws check
    max_draws = int(await config_service.get_setting("max_draws_per_promotion", 0))
    if max_draws > 0:
        draw_count = await Draw.find({"promotion_id": promotion.id}).count()
        if draw_count >= max_draws:
            raise HTTPException(status_code=400, detail="Maximum draws for this promotion reached")

    # 4. Min transactions check
    eligible = await get_eligible_transactions(promotion)
    min_txns = int(await config_service.get_setting("min_transactions_per_draw", 1))
    if len(eligible) < min_txns:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough eligible transactions (need {min_txns}, have {len(eligible)})",
        )

    return eligible


async def execute_draw(
    promotion_id: PydanticObjectId,
    presenter_id: Optional[PydanticObjectId] = None,
    draw_type: str = "manual",
    notes: Optional[str] = None,
) -> Draw:
    promotion = await Promotion.get(promotion_id)
    if not promotion:
        raise HTTPException(status_code=404, detail="Promotion not found")

    eligible = await validate_draw(promotion, presenter_id)

    lottery = await Lottery.get(promotion.lottery_id)

    # Select winner
    if lottery.lottery_type == "sequential":
        winner = min(eligible, key=lambda t: t.payment_date)
    else:
        winner = random.choice(eligible)

    draw = Draw(
        promotion_id=promotion.id,
        presenter_id=presenter_id,
        transaction_id=winner.id,
        winning_number=winner.transaction_number,
        draw_type=draw_type,
        notes=notes,
    )
    await draw.insert()
    return draw

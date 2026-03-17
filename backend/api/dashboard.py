from datetime import datetime, timedelta

from fastapi import APIRouter, Depends

from backend.auth.dependencies import get_current_user, require_admin
from backend.models.draw import Draw
from backend.models.lottery import Lottery
from backend.models.promotion import Promotion
from backend.models.transaction import Transaction
from backend.models.user import User

router = APIRouter(tags=["dashboard"])


@router.get("/api/admin/dashboard/stats")
async def admin_stats(_=Depends(require_admin)):
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    lotteries_total = await Lottery.count()
    lotteries_active = await Lottery.find({"is_active": True}).count()
    promotions_total = await Promotion.count()
    promotions_active = await Promotion.find({"status": "active"}).count()
    transactions_total = await Transaction.count()
    transactions_recent = await Transaction.find({"payment_date": {"$gte": thirty_days_ago}}).count()
    draws_total = await Draw.count()
    draws_recent = await Draw.find({"drawn_at": {"$gte": thirty_days_ago}}).count()
    users_total = await User.count()

    recent_draws = await Draw.find_all().sort("-drawn_at").limit(10).to_list()

    return {
        "lotteries": {"total": lotteries_total, "active": lotteries_active},
        "promotions": {"total": promotions_total, "active": promotions_active},
        "transactions": {"total": transactions_total, "last_30_days": transactions_recent},
        "draws": {"total": draws_total, "last_30_days": draws_recent},
        "users": {"total": users_total},
        "recent_draws": [{"id": str(d.id), **d.dict()} for d in recent_draws],
    }


@router.get("/api/dashboard/stats")
async def presenter_stats(current_user: User = Depends(get_current_user)):
    active = await Promotion.find_one({"status": "active", "user_id": current_user.id})
    my_promotions = await Promotion.find({"user_id": current_user.id}).to_list()
    my_promotion_ids = [p.id for p in my_promotions]

    draws_count = 0
    transactions_count = 0
    if my_promotion_ids:
        draws_count = await Draw.find({"promotion_id": {"$in": my_promotion_ids}}).count()

    if active:
        transactions_count = await Transaction.find(
            {
                "product_id": active.lottery_id,
                "payment_date": {"$gte": active.start_date, "$lte": active.end_date},
            }
        ).count()

    recent_draws = []
    if my_promotion_ids:
        recent_draws = (
            await Draw.find({"promotion_id": {"$in": my_promotion_ids}})
            .sort("-drawn_at")
            .limit(5)
            .to_list()
        )

    return {
        "active_promotions": 1 if active else 0,
        "total_promotions": len(my_promotions),
        "total_draws": draws_count,
        "total_transactions": transactions_count,
        "recent_draws": [{"id": str(d.id), **d.dict()} for d in recent_draws],
    }

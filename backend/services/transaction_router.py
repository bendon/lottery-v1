from typing import Optional

from backend.models.lottery import Lottery
from backend.models.promotion import Promotion
from backend.models.transaction import Transaction


async def route_transaction(transaction: Transaction) -> Optional[Lottery]:
    """
    Match transaction to lottery (and promotion when Paybill + account).
    Paybill: BusinessShortCode + BillRefNumber (account) → lottery + promotion.
    """
    shortcode = transaction.till_number or transaction.paybill_number
    if not shortcode:
        return None

    # Match lottery by shortcode
    lottery = await Lottery.find_one(
        {"$or": [{"till_number": shortcode}, {"paybill_number": shortcode}], "is_active": True}
    )
    if not lottery:
        return None

    transaction.product_type = "lottery"
    transaction.product_id = lottery.id

    # Paybill + account_number: match to promotion for concurrent promotions
    if transaction.payment_type == "paybill" and transaction.bill_ref_number:
        promo = await Promotion.find_one(
            {
                "lottery_id": lottery.id,
                "account_number": transaction.bill_ref_number,
                "status": "active",
            }
        )
        if promo:
            transaction.promotion_id = promo.id

    await transaction.save()
    return lottery

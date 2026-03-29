from typing import Optional

from backend.models.lottery import Lottery
from backend.models.promotion import Promotion
from backend.models.transaction import Transaction
from backend.services.lottery_payment_mode import lottery_uses_paybill_accounts


async def route_transaction(transaction: Transaction) -> Optional[Lottery]:
    """
    Match transaction to lottery and promotion when applicable.
    Paybill: BusinessShortCode + BillRefNumber → promotion via account_number.
    Till / STK: single active promotion on lottery → promotion_id.
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

    if lottery_uses_paybill_accounts(lottery) and transaction.payment_type == "paybill" and transaction.bill_ref_number:
        promo = await Promotion.find_one(
            {
                "lottery_id": lottery.id,
                "account_number": transaction.bill_ref_number,
                "status": "active",
            }
        )
        if promo:
            transaction.promotion_id = promo.id
    elif not lottery_uses_paybill_accounts(lottery) and transaction.payment_type in ("till", "stk_push"):
        promo = await Promotion.find_one({"lottery_id": lottery.id, "status": "active"})
        if promo:
            transaction.promotion_id = promo.id

    await transaction.save()
    return lottery

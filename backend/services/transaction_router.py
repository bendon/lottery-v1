from typing import Optional

from backend.models.lottery import Lottery
from backend.models.transaction import Transaction


async def route_transaction(transaction: Transaction) -> Optional[Lottery]:
    """Match transaction to a lottery based on till/paybill. C2B sends BusinessShortCode (stored as till_number)."""
    shortcode = transaction.till_number or transaction.paybill_number
    if not shortcode:
        return None

    # Match lottery by shortcode (Till or Paybill - both use same BusinessShortCode)
    for condition in [{"till_number": shortcode}, {"paybill_number": shortcode}]:
        lottery = await Lottery.find_one(
            {**condition, "is_active": True}
        )
        if lottery:
            transaction.product_type = "lottery"
            transaction.product_id = lottery.id
            await transaction.save()
            return lottery

    return None

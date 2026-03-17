from typing import Optional

from backend.models.lottery import Lottery
from backend.models.transaction import Transaction


async def route_transaction(transaction: Transaction) -> Optional[Lottery]:
    """Match transaction to a lottery based on till/paybill/api_integration_id."""
    query_conditions = []

    if transaction.till_number:
        query_conditions.append({"till_number": transaction.till_number})
    if transaction.paybill_number:
        query_conditions.append({"paybill_number": transaction.paybill_number})
    if transaction.api_integration_id:
        query_conditions.append({"api_integration_id": transaction.api_integration_id})

    if not query_conditions:
        return None

    for condition in query_conditions:
        lottery = await Lottery.find_one(
            {**condition, "is_active": True}
        )
        if lottery:
            transaction.product_type = "lottery"
            transaction.product_id = lottery.id
            await transaction.save()
            return lottery

    return None

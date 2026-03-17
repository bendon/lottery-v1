import time
from typing import Any, Optional

from backend.models.system_setting import SystemSetting

# Default values if not found in DB
DEFAULTS = {
    "draw_cooldown_minutes": 5,
    "min_transactions_per_draw": 1,
    "max_draws_per_promotion": 0,  # 0 = unlimited
    "default_payout_amount": 0,
    "default_payout_percentage": 0,
}

_cache: dict = {}
_cache_ts: float = 0
CACHE_TTL = 300  # 5 minutes


async def get_all_settings() -> dict:
    global _cache, _cache_ts
    now = time.time()
    if _cache and (now - _cache_ts) < CACHE_TTL:
        return _cache

    settings = await SystemSetting.find_all().to_list()
    result = dict(DEFAULTS)
    for s in settings:
        if s.value_type == "string":
            result[s.key] = s.value
        else:
            result[s.key] = s.structured_value or s.value

    _cache = result
    _cache_ts = now
    return result


async def get_setting(key: str, default: Any = None) -> Any:
    all_settings = await get_all_settings()
    return all_settings.get(key, default if default is not None else DEFAULTS.get(key))


def invalidate_cache():
    global _cache_ts
    _cache_ts = 0

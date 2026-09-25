import json
from typing import Any, Optional
import redis.asyncio as aioredis
from app.core.config import settings
from app.core.logging import logger

redis_client: Optional[aioredis.Redis] = None


async def get_redis_client() -> aioredis.Redis:
    """
    Returns an async Redis client instance, lazily initializing connection pool if necessary.
    """
    global redis_client
    if redis_client is None:
        redis_client = aioredis.from_url(
            settings.REDIS_URL,
            encoding="utf-8",
            decode_responses=True,
            health_check_interval=30,
        )
    return redis_client


class CacheService:
    @staticmethod
    async def get(key: str) -> Optional[Any]:
        """
        Retrieves and JSON-deserializes cached data.
        Returns None on cache miss or connection error.
        """
        try:
            client = await get_redis_client()
            cached_raw = await client.get(key)
            if cached_raw:
                logger.debug("cache_hit", key=key)
                return json.loads(cached_raw)
            logger.debug("cache_miss", key=key)
            return None
        except Exception as exc:
            logger.warning("cache_get_error", key=key, error=str(exc))
            return None

    @staticmethod
    async def set(key: str, value: Any, ttl: int = 300) -> bool:
        """
        JSON-serializes and stores data in Redis with a TTL (seconds).
        """
        try:
            client = await get_redis_client()
            serialized = json.dumps(value, default=str)
            await client.setex(key, ttl, serialized)
            logger.debug("cache_set", key=key, ttl=ttl)
            return True
        except Exception as exc:
            logger.warning("cache_set_error", key=key, error=str(exc))
            return False

    @staticmethod
    async def delete_prefix(prefix: str) -> int:
        """
        Invalidates all cache keys matching a prefix (e.g. 'centres:*').
        """
        try:
            client = await get_redis_client()
            keys = []
            async for key in client.scan_iter(f"{prefix}*"):
                keys.append(key)
            if keys:
                deleted_count = await client.delete(*keys)
                logger.info("cache_invalidated", prefix=prefix, count=deleted_count)
                return deleted_count
            return 0
        except Exception as exc:
            logger.warning("cache_delete_error", prefix=prefix, error=str(exc))
            return 0


cache_service = CacheService()

import os
import json
import asyncio
import logging
from typing import Dict, Any, Optional, List
from fastapi import WebSocket

logger = logging.getLogger("stocksentry.websocket")
REDIS_CHANNEL = "stocksentry:ws_events"


class ConnectionManager:
    def __init__(self):
        # Maps WebSocket -> scope dict: {user_id, role, region_id, city_id, territory_ids}
        self.active_connections: Dict[WebSocket, Dict[str, Any]] = {}
        self.redis_url: Optional[str] = os.getenv("REDIS_URL")
        self._redis_pub = None
        self._listener_task: Optional[asyncio.Task] = None

    async def start_redis_listener(self):
        if not self.redis_url or self._listener_task is not None:
            return
        try:
            import redis.asyncio as aioredis
            self._redis_pub = aioredis.from_url(self.redis_url, decode_responses=True)
            self._listener_task = asyncio.create_task(self._listen_redis())
            logger.info("WebSocket Redis pub/sub listener started.")
        except Exception as e:
            logger.warning(f"Redis pub/sub unavailable, falling back to local WS delivery: {e}")

    async def stop_redis_listener(self):
        if self._listener_task:
            self._listener_task.cancel()
            self._listener_task = None
        if self._redis_pub:
            await self._redis_pub.close()
            self._redis_pub = None

    async def _listen_redis(self):
        import redis.asyncio as aioredis
        sub_client = aioredis.from_url(self.redis_url, decode_responses=True)
        pubsub = sub_client.pubsub()
        await pubsub.subscribe(REDIS_CHANNEL)
        try:
            async for raw in pubsub.listen():
                if raw and raw.get("type") == "message":
                    try:
                        payload = json.loads(raw["data"])
                        await self._deliver_local(payload)
                    except Exception as err:
                        logger.error(f"Failed to deliver Redis WS event: {err}")
        except asyncio.CancelledError:
            pass
        finally:
            await pubsub.unsubscribe(REDIS_CHANNEL)
            await sub_client.close()

    async def connect(self, websocket: WebSocket, user_scope: Dict[str, Any]):
        await websocket.accept()
        self.active_connections[websocket] = user_scope
        logger.info(f"WebSocket connected (role={user_scope.get('role')}). Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.pop(websocket, None)
            logger.info(f"WebSocket disconnected. Remaining: {len(self.active_connections)}")

    def _is_in_scope(self, conn_scope: Dict[str, Any], message: Dict[str, Any]) -> bool:
        role = conn_scope.get("role", "")
        if role in ("SUPER_ADMIN", "CENTRAL_ADMIN"):
            return True

        data = message.get("data") if isinstance(message.get("data"), dict) else {}
        target_user_id = message.get("target_user_id") or data.get("target_user_id") or data.get("requested_by")
        target_region_id = message.get("region_id") or data.get("region_id")
        target_location_id = message.get("location_id") or data.get("location_id") or data.get("city_id")
        target_roles: Optional[List[str]] = message.get("target_roles")

        if target_roles and role not in target_roles:
            return False

        if target_user_id and conn_scope.get("user_id") == target_user_id:
            return True

        if role == "REGIONAL_ADMIN":
            if target_region_id is not None:
                return conn_scope.get("region_id") == target_region_id
            return False

        if role in ("MANAGER", "LOCATION_MANAGER"):
            if target_location_id is not None:
                return target_location_id in (conn_scope.get("territory_ids") or [])
            return False

        if role == "FIELD_WORKER":
            if target_user_id is not None:
                return conn_scope.get("user_id") == target_user_id
            return False

        return False

    async def _deliver_local(self, message: Dict[str, Any]):
        message_str = json.dumps(message, default=str)
        disconnected = []
        for connection, scope in list(self.active_connections.items()):
            if not self._is_in_scope(scope, message):
                continue
            try:
                await connection.send_text(message_str)
            except Exception as e:
                logger.error(f"Error sending WebSocket message: {e}")
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast(self, message: Dict[str, Any]):
        """
        Publishes a scoped event through Redis pub/sub (if configured) so all Gunicorn workers
        receive and deliver it only to in-scope WebSocket clients.
        """
        if self._redis_pub:
            try:
                await self._redis_pub.publish(REDIS_CHANNEL, json.dumps(message, default=str))
                return
            except Exception as e:
                logger.warning(f"Redis publish failed, delivering locally: {e}")
        await self._deliver_local(message)


ws_manager = ConnectionManager()

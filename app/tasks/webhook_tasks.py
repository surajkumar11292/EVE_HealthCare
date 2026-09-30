import asyncio
from datetime import datetime, timezone
import json
from typing import Any, Dict, Optional
import uuid

from sqlalchemy import select

from app.core.logging import logger
from app.db.session import AsyncSessionLocal
from app.models.booking import Booking, BookingStatus
from app.models.payment import Payment, PaymentStatus
from app.models.webhook_event import WebhookEvent, WebhookStatus
from app.schemas.payment import WebhookPayload
from app.services.payment_service import payment_service
from app.tasks.celery_app import celery_app


async def _async_process_webhook_internal(
    raw_body_bytes: bytes,
    payload_dict: Dict[str, Any],
    signature: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes the idempotent webhook verification and booking update
    within an isolated AsyncSession for background task execution.
    """
    payload = WebhookPayload.model_validate(payload_dict)

    async with AsyncSessionLocal() as session:
        # Check if already processed
        res = await session.execute(
            select(WebhookEvent).where(WebhookEvent.event_id == payload.event_id)
        )
        existing = res.scalar_one_or_none()

        if existing and existing.status == WebhookStatus.PROCESSED:
            logger.info("celery_webhook_already_processed", event_id=payload.event_id)
            return {"status": "already_processed", "event_id": payload.event_id}

        result = await payment_service.process_webhook(
            db=session,
            raw_body=raw_body_bytes,
            payload=payload,
            signature_header=signature,
        )
        return result.model_dump()


@celery_app.task(
    bind=True,
    name="app.tasks.webhook_tasks.process_webhook_event_task",
    max_retries=5,
    default_retry_delay=5,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
    task_acks_late=True,
)
def process_webhook_event_task(
    self,
    raw_body_str: str,
    payload_dict: Dict[str, Any],
    signature: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Celery background worker task for asynchronous webhook processing.
    Configured with automatic retry, exponential backoff (5s, 10s, 20s, 40s, 80s),
    and randomized jitter to avoid thundering-herd issues on downstream database spikes.
    """
    event_id = payload_dict.get("event_id", "unknown")
    logger.info(
        "celery_webhook_task_started",
        event_id=event_id,
        attempt=self.request.retries + 1,
        max_retries=self.max_retries,
    )

    try:
        raw_body_bytes = raw_body_str.encode("utf-8")
        result = asyncio.run(
            _async_process_webhook_internal(
                raw_body_bytes=raw_body_bytes,
                payload_dict=payload_dict,
                signature=signature,
            )
        )
        logger.info(
            "celery_webhook_task_succeeded",
            event_id=event_id,
            result=result,
        )
        return result
    except Exception as exc:
        logger.error(
            "celery_webhook_task_failed_attempt",
            event_id=event_id,
            attempt=self.request.retries + 1,
            error=str(exc),
        )
        # Re-raise to trigger Celery's autoretry with exponential backoff
        raise exc


@celery_app.task(
    bind=True,
    name="app.tasks.webhook_tasks.send_booking_confirmation_email_task",
    max_retries=3,
    default_retry_delay=3,
    retry_backoff=True,
)
def send_booking_confirmation_email_task(
    self,
    booking_id: str,
    recipient_email: str,
) -> Dict[str, Any]:
    """
    Simulated asynchronous notification task dispatched after successful payment.
    Demonstrates background worker job handling and decouple from HTTP request loop.
    """
    logger.info(
        "sending_booking_confirmation_email",
        booking_id=booking_id,
        recipient_email=recipient_email,
        attempt=self.request.retries + 1,
    )

    # Simulated email delivery delay
    return {
        "status": "delivered",
        "booking_id": booking_id,
        "recipient_email": recipient_email,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }

import json
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.models.user import User
from app.schemas.payment import (
    PaymentCreateRequest,
    PaymentResponse,
    WebhookPayload,
    WebhookResponse,
)
from app.services.payment_service import payment_service

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.post(
    "/",
    response_model=PaymentResponse,
    status_code=status.HTTP_200_OK,
    summary="Process simulated payment",
    description=(
        "Simulates payment processing for a diagnostic test booking. "
        "Enforces client-side idempotency using 'idempotency_key' and updates booking state "
        "to CONFIRMED on SUCCESS or FAILED on failure."
    ),
)
@limiter.limit(settings.RATE_LIMIT_PAYMENT)
async def create_payment(
    request: Request,
    payload: PaymentCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentResponse:
    return await payment_service.create_payment(db, current_user, payload)


@router.post(
    "/webhook/",
    response_model=WebhookResponse,
    status_code=status.HTTP_200_OK,
    summary="Payment provider webhook",
    description=(
        "Receives payment status updates from the simulated payment provider. "
        "Cryptographically verifies the HMAC-SHA256 signature and uses database row locks "
        "to guarantee idempotency against concurrent or repeated event deliveries."
    ),
)
@limiter.limit(settings.RATE_LIMIT_WEBHOOK)
async def payment_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_webhook_signature: Optional[str] = Header(None, alias="X-Webhook-Signature"),
) -> WebhookResponse:
    raw_body = await request.body()
    try:
        data = json.loads(raw_body)
        payload = WebhookPayload.model_validate(data)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid webhook JSON payload: {str(exc)}",
        )

    return await payment_service.process_webhook(
        db=db,
        raw_body=raw_body,
        payload=payload,
        signature_header=x_webhook_signature,
    )


@router.get(
    "/{payment_id}",
    response_model=PaymentResponse,
    summary="Get payment details",
    description="Retrieves a payment record by ID. Patients may only view payments for their own bookings.",
)
async def get_payment(
    payment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentResponse:
    return await payment_service.get_payment(db, payment_id, current_user)


@router.get(
    "/booking/{booking_id}",
    response_model=PaymentResponse,
    summary="Get payment by booking ID",
    description="Retrieves the payment associated with a specific diagnostic booking.",
)
async def get_payment_by_booking(
    booking_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PaymentResponse:
    return await payment_service.get_payment_by_booking(db, booking_id, current_user)

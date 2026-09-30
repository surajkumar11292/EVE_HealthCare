from datetime import datetime
from decimal import Decimal
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field

from app.models.payment import PaymentStatus


class PaymentCreateRequest(BaseModel):
    """
    Request payload to initiate a simulated payment for a diagnostic booking.
    """
    booking_id: uuid.UUID = Field(..., description="ID of the booking to pay for")
    idempotency_key: str = Field(
        ...,
        min_length=8,
        max_length=255,
        description="Client-generated unique key to prevent duplicate charges on network retries",
    )
    force_status: Optional[PaymentStatus] = Field(
        None,
        description="Optional parameter to force payment outcome (SUCCESS or FAILED) for testing/demonstration",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "booking_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
                "idempotency_key": "pay_idem_9f82ab7c312489",
                "force_status": "SUCCESS",
            }
        }
    )


class PaymentResponse(BaseModel):
    """
    Detailed payment response schema.
    """
    id: uuid.UUID
    booking_id: uuid.UUID
    transaction_id: str
    idempotency_key: str
    provider: str
    amount: Decimal
    status: PaymentStatus
    failure_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class WebhookPayload(BaseModel):
    """
    Simulated payment provider webhook event payload.
    """
    event_id: str = Field(..., description="Unique event identifier from payment provider for idempotency tracking")
    event_type: str = Field(..., description="Event type, e.g. 'payment.success' or 'payment.failed'")
    transaction_id: str = Field(..., description="Associated transaction ID")
    booking_id: uuid.UUID = Field(..., description="Booking UUID")
    status: PaymentStatus = Field(..., description="Resulting payment status (SUCCESS or FAILED)")
    failure_reason: Optional[str] = Field(None, description="Reason if status is FAILED")
    signature: Optional[str] = Field(None, description="HMAC-SHA256 signature if sent in request body")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "event_id": "evt_sim_9238472398472",
                "event_type": "payment.success",
                "transaction_id": "TXN-8A3B9C1D0E4F",
                "booking_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
                "status": "SUCCESS",
                "failure_reason": None,
                "signature": "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
            }
        }
    )


class WebhookResponse(BaseModel):
    """
    Response returned to webhook caller.
    """
    status: str
    message: str
    event_id: str

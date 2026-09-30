import asyncio
import json
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus
from app.services.payment_service import payment_service


@pytest.mark.asyncio
async def test_webhook_processing_success(
    client: AsyncClient,
    sample_booking: Booking,
    db_session: AsyncSession,
):
    """
    Verifies that a valid webhook with HMAC signature updates the booking to CONFIRMED.
    """
    event_id = f"evt_{uuid.uuid4().hex[:12]}"
    payload_dict = {
        "event_id": event_id,
        "event_type": "payment.success",
        "transaction_id": "TXN-WEBHOOK-SUCCESS-1",
        "booking_id": str(sample_booking.id),
        "status": "SUCCESS",
        "failure_reason": None,
    }
    raw_body = json.dumps(payload_dict).encode("utf-8")
    valid_signature = payment_service.generate_signature(raw_body)

    response = await client.post(
        "/api/v1/payments/webhook/",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Signature": valid_signature,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "processed"
    assert data["event_id"] == event_id

    # Verify DB booking status
    await db_session.refresh(sample_booking)
    assert sample_booking.status == BookingStatus.CONFIRMED


@pytest.mark.asyncio
async def test_webhook_idempotency_duplicate_event(
    client: AsyncClient,
    sample_booking: Booking,
):
    """
    Verifies that receiving the exact same webhook event_id multiple times
    returns 'already_processed' without creating duplicates or altering state.
    """
    event_id = f"evt_{uuid.uuid4().hex[:12]}"
    payload_dict = {
        "event_id": event_id,
        "event_type": "payment.success",
        "transaction_id": "TXN-WEBHOOK-IDEM-1",
        "booking_id": str(sample_booking.id),
        "status": "SUCCESS",
    }
    raw_body = json.dumps(payload_dict).encode("utf-8")
    signature = payment_service.generate_signature(raw_body)
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
    }

    # First delivery
    res1 = await client.post("/api/v1/payments/webhook/", content=raw_body, headers=headers)
    assert res1.status_code == 200
    assert res1.json()["status"] == "processed"

    # Second delivery with exact same event_id
    res2 = await client.post("/api/v1/payments/webhook/", content=raw_body, headers=headers)
    assert res2.status_code == 200
    assert res2.json()["status"] == "already_processed"


@pytest.mark.asyncio
async def test_webhook_invalid_signature_rejected(
    client: AsyncClient,
    sample_booking: Booking,
):
    """
    Verifies that a webhook request with an invalid/tampered signature is rejected with 401.
    """
    payload_dict = {
        "event_id": f"evt_{uuid.uuid4().hex[:12]}",
        "event_type": "payment.success",
        "transaction_id": "TXN-TAMPERED-1",
        "booking_id": str(sample_booking.id),
        "status": "SUCCESS",
    }
    raw_body = json.dumps(payload_dict).encode("utf-8")

    response = await client.post(
        "/api/v1/payments/webhook/",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Webhook-Signature": "invalid_tampered_signature_hex_1234567890",
        },
    )

    assert response.status_code == 401
    assert "invalid webhook signature" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_webhook_body_embedded_signature(
    client: AsyncClient,
    sample_booking: Booking,
):
    """
    Verifies that the webhook processor accepts signature passed inside the payload body
    over canonical event representation.
    """
    event_id = f"evt_{uuid.uuid4().hex[:12]}"
    canonical_bytes = f"{event_id}:{sample_booking.id}:SUCCESS".encode("utf-8")
    sig = payment_service.generate_signature(canonical_bytes)

    payload_dict = {
        "event_id": event_id,
        "event_type": "payment.success",
        "transaction_id": "TXN-EMBEDDED-SIG-1",
        "booking_id": str(sample_booking.id),
        "status": "SUCCESS",
        "signature": sig,
    }

    response = await client.post(
        "/api/v1/payments/webhook/",
        json=payload_dict,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "processed"


@pytest.mark.asyncio
async def test_webhook_non_existent_booking(
    client: AsyncClient,
):
    """
    Verifies that a webhook event targeting a non-existent booking returns 200 OK
    with booking_not_found to prevent external payment gateway retry loops.
    """
    fake_booking_id = str(uuid.uuid4())
    event_id = f"evt_{uuid.uuid4().hex[:12]}"
    canonical_bytes = f"{event_id}:{fake_booking_id}:SUCCESS".encode("utf-8")
    sig = payment_service.generate_signature(canonical_bytes)

    payload_dict = {
        "event_id": event_id,
        "event_type": "payment.success",
        "transaction_id": "TXN-FAKE-1",
        "booking_id": fake_booking_id,
        "status": "SUCCESS",
        "signature": sig,
    }

    response = await client.post(
        "/api/v1/payments/webhook/",
        json=payload_dict,
    )

    assert response.status_code == 200
    assert response.json()["status"] == "booking_not_found"


@pytest.mark.asyncio
async def test_concurrent_webhook_deliveries(
    client: AsyncClient,
    sample_booking: Booking,
):
    """
    Verifies that simultaneous concurrent deliveries of the same webhook event_id
    are handled safely without race conditions.
    """
    event_id = f"evt_concurrent_{uuid.uuid4().hex[:12]}"
    payload_dict = {
        "event_id": event_id,
        "event_type": "payment.success",
        "transaction_id": "TXN-CONCURRENT-1",
        "booking_id": str(sample_booking.id),
        "status": "SUCCESS",
    }
    raw_body = json.dumps(payload_dict).encode("utf-8")
    sig = payment_service.generate_signature(raw_body)
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": sig,
    }

    # Dispatch 5 concurrent requests
    responses = await asyncio.gather(
        client.post("/api/v1/payments/webhook/", content=raw_body, headers=headers),
        client.post("/api/v1/payments/webhook/", content=raw_body, headers=headers),
        client.post("/api/v1/payments/webhook/", content=raw_body, headers=headers),
        client.post("/api/v1/payments/webhook/", content=raw_body, headers=headers),
        client.post("/api/v1/payments/webhook/", content=raw_body, headers=headers),
    )

    # All responses must be HTTP 200
    for r in responses:
        assert r.status_code == 200

    statuses = [r.json()["status"] for r in responses]
    # At least one must be 'processed', and remaining must be 'already_processed'
    assert "processed" in statuses
    assert all(s in ["processed", "already_processed"] for s in statuses)


@pytest.mark.asyncio
async def test_webhook_root_endpoint_compatibility(
    client: AsyncClient,
    sample_booking: Booking,
):
    """
    Verifies that the root path POST /payments/webhook/ (as specified in assignment)
    works identically to /api/v1/payments/webhook/.
    """
    event_id = f"evt_root_{uuid.uuid4().hex[:12]}"
    payload_dict = {
        "event_id": event_id,
        "event_type": "payment.success",
        "transaction_id": "TXN-ROOT-WEBHOOK-1",
        "booking_id": str(sample_booking.id),
        "status": "SUCCESS",
    }
    raw_body = json.dumps(payload_dict).encode("utf-8")
    sig = payment_service.generate_signature(raw_body)
    headers = {
        "Content-Type": "application/json",
        "X-Webhook-Signature": sig,
    }

    response = await client.post("/payments/webhook/", content=raw_body, headers=headers)
    assert response.status_code == 200
    assert response.json()["status"] == "processed"
    assert response.json()["event_id"] == event_id



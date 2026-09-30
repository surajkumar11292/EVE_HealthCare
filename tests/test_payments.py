import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus
from app.models.payment import PaymentStatus


@pytest.mark.asyncio
async def test_create_payment_success(
    client: AsyncClient,
    patient_headers: dict,
    sample_booking: Booking,
    db_session: AsyncSession,
):
    """
    Verifies that initiating a simulated payment with force_status=SUCCESS
    creates a payment record and transitions booking status to CONFIRMED.
    """
    payload = {
        "booking_id": str(sample_booking.id),
        "idempotency_key": "idem_test_success_123456",
        "force_status": "SUCCESS",
    }

    response = await client.post(
        "/api/v1/payments/",
        json=payload,
        headers=patient_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["booking_id"] == str(sample_booking.id)
    assert data["status"] == "SUCCESS"
    assert data["idempotency_key"] == "idem_test_success_123456"
    assert data["transaction_id"].startswith("TXN-")
    assert float(data["amount"]) == float(sample_booking.amount)

    # Check that booking in DB transitioned to CONFIRMED
    await db_session.refresh(sample_booking)
    assert sample_booking.status == BookingStatus.CONFIRMED


@pytest.mark.asyncio
async def test_create_payment_failure(
    client: AsyncClient,
    patient_headers: dict,
    sample_booking: Booking,
    db_session: AsyncSession,
):
    """
    Verifies that initiating a simulated payment with force_status=FAILED
    updates booking status to FAILED and records failure_reason.
    """
    payload = {
        "booking_id": str(sample_booking.id),
        "idempotency_key": "idem_test_failure_123456",
        "force_status": "FAILED",
    }

    response = await client.post(
        "/api/v1/payments/",
        json=payload,
        headers=patient_headers,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "FAILED"
    assert data["failure_reason"] is not None

    await db_session.refresh(sample_booking)
    assert sample_booking.status == BookingStatus.FAILED


@pytest.mark.asyncio
async def test_payment_idempotency(
    client: AsyncClient,
    patient_headers: dict,
    sample_booking: Booking,
):
    """
    Verifies that repeating the same payment request with the same idempotency_key
    returns the cached/recorded payment without creating duplicates.
    """
    payload = {
        "booking_id": str(sample_booking.id),
        "idempotency_key": "idem_duplicate_test_key",
        "force_status": "SUCCESS",
    }

    # First request
    res1 = await client.post("/api/v1/payments/", json=payload, headers=patient_headers)
    assert res1.status_code == 200
    data1 = res1.json()

    # Second request with identical idempotency_key
    res2 = await client.post("/api/v1/payments/", json=payload, headers=patient_headers)
    assert res2.status_code == 200
    data2 = res2.json()

    # Both requests must return the exact same payment ID and transaction ID
    assert data1["id"] == data2["id"]
    assert data1["transaction_id"] == data2["transaction_id"]


@pytest.mark.asyncio
async def test_payment_unauthorized_user(
    client: AsyncClient,
    other_patient_headers: dict,
    sample_booking: Booking,
):
    """
    Verifies that a patient cannot initiate a payment for another patient's booking (403 Forbidden).
    """
    payload = {
        "booking_id": str(sample_booking.id),
        "idempotency_key": "idem_unauthorized_attempt",
        "force_status": "SUCCESS",
    }

    response = await client.post(
        "/api/v1/payments/",
        json=payload,
        headers=other_patient_headers,
    )
    assert response.status_code == 403
    assert "permission" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_payment_already_confirmed_conflict(
    client: AsyncClient,
    patient_headers: dict,
    sample_booking: Booking,
    db_session: AsyncSession,
):
    """
    Verifies that paying for an already confirmed booking returns 409 Conflict.
    """
    sample_booking.status = BookingStatus.CONFIRMED
    await db_session.commit()

    payload = {
        "booking_id": str(sample_booking.id),
        "idempotency_key": "idem_conflict_confirmed_test",
    }

    response = await client.post(
        "/api/v1/payments/",
        json=payload,
        headers=patient_headers,
    )
    assert response.status_code == 409
    assert "already confirmed" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_payment_cancelled_conflict(
    client: AsyncClient,
    patient_headers: dict,
    sample_booking: Booking,
    db_session: AsyncSession,
):
    """
    Verifies that paying for a cancelled booking returns 409 Conflict.
    """
    sample_booking.status = BookingStatus.CANCELLED
    await db_session.commit()

    payload = {
        "booking_id": str(sample_booking.id),
        "idempotency_key": "idem_conflict_cancelled_test",
    }

    response = await client.post(
        "/api/v1/payments/",
        json=payload,
        headers=patient_headers,
    )
    assert response.status_code == 409
    assert "cancelled" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_payment_non_existent_booking(
    client: AsyncClient,
    patient_headers: dict,
):
    """
    Verifies that paying for a non-existent booking returns 404 Not Found.
    """
    payload = {
        "booking_id": str(uuid.uuid4()),
        "idempotency_key": "idem_non_existent_booking",
    }

    response = await client.post(
        "/api/v1/payments/",
        json=payload,
        headers=patient_headers,
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_payment_by_id_and_booking(
    client: AsyncClient,
    patient_headers: dict,
    admin_headers: dict,
    other_patient_headers: dict,
    sample_booking: Booking,
):
    """
    Verifies retrieving payment by ID and by booking ID, including ownership checks.
    """
    # Create payment first
    create_res = await client.post(
        "/api/v1/payments/",
        json={
            "booking_id": str(sample_booking.id),
            "idempotency_key": "idem_get_payment_test",
            "force_status": "SUCCESS",
        },
        headers=patient_headers,
    )
    payment_id = create_res.json()["id"]

    # 1. Owner patient can view
    get_res = await client.get(f"/api/v1/payments/{payment_id}", headers=patient_headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == payment_id

    # 2. Admin can view
    admin_res = await client.get(f"/api/v1/payments/{payment_id}", headers=admin_headers)
    assert admin_res.status_code == 200

    # 3. Other patient cannot view (403 Forbidden)
    other_res = await client.get(f"/api/v1/payments/{payment_id}", headers=other_patient_headers)
    assert other_res.status_code == 403

    # 4. Get by booking ID
    by_booking_res = await client.get(
        f"/api/v1/payments/booking/{sample_booking.id}", headers=patient_headers
    )
    assert by_booking_res.status_code == 200
    assert by_booking_res.json()["id"] == payment_id

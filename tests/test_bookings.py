from datetime import datetime, timedelta, timezone
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.booking import Booking, BookingStatus
from app.models.centre_test import CentreTest
from app.models.user import User


@pytest.mark.asyncio
async def test_create_booking_success(
    client: AsyncClient,
    patient_headers: dict,
    sample_centre_test: CentreTest,
    patient_user: User,
):
    """
    Verifies creating a diagnostic booking snapshots the current test price
    and initialises status to PENDING.
    """
    future_date = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    payload = {
        "centre_test_id": str(sample_centre_test.id),
        "appointment_time": future_date,
        "notes": "Fast for 12 hours before test",
    }

    response = await client.post("/api/v1/bookings/", json=payload, headers=patient_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["centre_test_id"] == str(sample_centre_test.id)
    assert data["status"] == "PENDING"
    assert float(data["amount"]) == float(sample_centre_test.price)
    assert data["user_id"] == str(patient_user.id)


@pytest.mark.asyncio
async def test_create_booking_past_date_validation(
    client: AsyncClient,
    patient_headers: dict,
    sample_centre_test: CentreTest,
):
    """
    Verifies that appointment dates in the past are rejected with 422/400.
    """
    past_date = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    payload = {
        "centre_test_id": str(sample_centre_test.id),
        "appointment_time": past_date,
    }

    response = await client.post("/api/v1/bookings/", json=payload, headers=patient_headers)
    assert response.status_code in [400, 422]


@pytest.mark.asyncio
async def test_create_booking_unavailable_test(
    client: AsyncClient,
    patient_headers: dict,
    sample_centre_test: CentreTest,
    db_session: AsyncSession,
):
    """
    Verifies that booking an unavailable test returns 400 Bad Request.
    """
    sample_centre_test.is_available = False
    await db_session.commit()

    future_date = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    payload = {
        "centre_test_id": str(sample_centre_test.id),
        "appointment_time": future_date,
    }

    response = await client.post("/api/v1/bookings/", json=payload, headers=patient_headers)
    assert response.status_code == 400
    assert "unavailable" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_list_bookings_isolation(
    client: AsyncClient,
    patient_headers: dict,
    other_patient_headers: dict,
    admin_headers: dict,
    sample_booking: Booking,
):
    """
    Verifies strict tenant isolation on booking lists:
    - Owner patient sees their own booking.
    - Other patient sees an empty list.
    - Admin sees all bookings.
    """
    # 1. Owner patient
    res_owner = await client.get("/api/v1/bookings/", headers=patient_headers)
    assert res_owner.status_code == 200
    assert res_owner.json()["total"] == 1
    assert res_owner.json()["items"][0]["id"] == str(sample_booking.id)

    # 2. Other patient
    res_other = await client.get("/api/v1/bookings/", headers=other_patient_headers)
    assert res_other.status_code == 200
    assert res_other.json()["total"] == 0

    # 3. Admin sees everything
    res_admin = await client.get("/api/v1/bookings/", headers=admin_headers)
    assert res_admin.status_code == 200
    assert res_admin.json()["total"] >= 1


@pytest.mark.asyncio
async def test_get_booking_by_id(
    client: AsyncClient,
    patient_headers: dict,
    other_patient_headers: dict,
    sample_booking: Booking,
):
    """
    Verifies that owner can view their booking, while unauthorized users get 403 Forbidden.
    """
    # Owner
    res_owner = await client.get(f"/api/v1/bookings/{sample_booking.id}", headers=patient_headers)
    assert res_owner.status_code == 200
    assert res_owner.json()["id"] == str(sample_booking.id)

    # Unauthorized patient
    res_unauth = await client.get(f"/api/v1/bookings/{sample_booking.id}", headers=other_patient_headers)
    assert res_unauth.status_code == 403


@pytest.mark.asyncio
async def test_cancel_booking_flow(
    client: AsyncClient,
    patient_headers: dict,
    sample_booking: Booking,
    db_session: AsyncSession,
):
    """
    Verifies booking cancellation lifecycle:
    - PENDING booking can be cancelled -> CANCELLED
    - Already CANCELLED booking cannot be cancelled again (409 Conflict)
    """
    # 1. Cancel PENDING
    cancel_res = await client.post(
        f"/api/v1/bookings/{sample_booking.id}/cancel",
        json={"cancellation_reason": "Schedule conflict"},
        headers=patient_headers,
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # Verify DB
    await db_session.refresh(sample_booking)
    assert sample_booking.status == BookingStatus.CANCELLED

    # 2. Duplicate cancellation returns 409
    dup_res = await client.post(
        f"/api/v1/bookings/{sample_booking.id}/cancel",
        headers=patient_headers,
    )
    assert dup_res.status_code == 409
    assert "already cancelled" in dup_res.json()["detail"].lower()


@pytest.mark.asyncio
async def test_cancel_failed_booking_conflict(
    client: AsyncClient,
    patient_headers: dict,
    sample_booking: Booking,
    db_session: AsyncSession,
):
    """
    Verifies that a FAILED booking cannot be cancelled (409 Conflict).
    """
    sample_booking.status = BookingStatus.FAILED
    await db_session.commit()

    response = await client.post(
        f"/api/v1/bookings/{sample_booking.id}/cancel",
        headers=patient_headers,
    )
    assert response.status_code == 409
    assert "failed" in response.json()["detail"].lower()

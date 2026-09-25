from typing import Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.booking import Booking, BookingStatus
from app.models.centre_test import CentreTest
from app.models.user import User, UserRole
from app.schemas.booking import (
    BookingCancelRequest,
    BookingCreateRequest,
    BookingResponse,
)
from app.services.booking_service import booking_service

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.post(
    "/",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new diagnostic test booking",
    description="Allows an authenticated patient to book a diagnostic test. Snapshots price and initialises status to PENDING.",
)
async def create_booking(
    payload: BookingCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookingResponse:
    booking = await booking_service.create_booking(db, current_user, payload)
    return booking


@router.get(
    "/",
    response_model=Page[BookingResponse],
    summary="List bookings (Paginated)",
    description="Returns a paginated list of bookings. Regular patients see only their own bookings; Admins can see all bookings.",
)
async def list_bookings(
    booking_status: Optional[BookingStatus] = Query(None, alias="status", description="Filter by booking state"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        select(Booking)
        .options(
            selectinload(Booking.user),
            selectinload(Booking.centre_test).selectinload(CentreTest.centre),
            selectinload(Booking.centre_test).selectinload(CentreTest.test),
        )
        .order_by(Booking.created_at.desc())
    )

    # Patient data isolation
    if current_user.role != UserRole.ADMIN:
        query = query.where(Booking.user_id == current_user.id)

    if booking_status is not None:
        query = query.where(Booking.status == booking_status)

    return await apaginate(
        db,
        query,
        transformer=lambda items: [booking_service._to_response(b) for b in items],
    )


@router.get(
    "/{booking_id}",
    response_model=BookingResponse,
    summary="Get booking details",
    description="Retrieves a single booking by ID. Patients may only view their own bookings; Admins may view any booking.",
)
async def get_booking(
    booking_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookingResponse:
    return await booking_service.get_booking(db, booking_id, current_user)


@router.post(
    "/{booking_id}/cancel",
    response_model=BookingResponse,
    summary="Cancel a booking",
    description="Cancels a booking. Allowed from PENDING or CONFIRMED state before appointment date. Prohibited from FAILED or CANCELLED.",
)
async def cancel_booking(
    booking_id: uuid.UUID,
    payload: Optional[BookingCancelRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BookingResponse:
    return await booking_service.cancel_booking(db, booking_id, current_user, payload)

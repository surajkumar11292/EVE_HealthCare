from datetime import datetime, timezone
from typing import Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.booking import Booking, BookingStatus
from app.models.centre_test import CentreTest
from app.models.user import User, UserRole
from app.schemas.booking import (
    BookingCancelRequest,
    BookingCreateRequest,
    BookingResponse,
)
from app.core.logging import logger


class BookingService:
    @staticmethod
    def _to_response(booking: Booking) -> BookingResponse:
        """
        Helper method to construct an enriched BookingResponse from a Booking entity.
        """
        centre_name = None
        centre_location = None
        test_name = None
        patient_email = None
        patient_name = None

        if booking.centre_test:
            if booking.centre_test.centre:
                centre_name = booking.centre_test.centre.name
                centre_location = booking.centre_test.centre.location
            if booking.centre_test.test:
                test_name = booking.centre_test.test.name

        if booking.user:
            patient_email = booking.user.email
            patient_name = booking.user.full_name

        return BookingResponse(
            id=booking.id,
            user_id=booking.user_id,
            centre_test_id=booking.centre_test_id,
            appointment_time=booking.appointment_time,
            amount=booking.amount,
            status=booking.status,
            notes=booking.notes,
            created_at=booking.created_at,
            updated_at=booking.updated_at,
            centre_name=centre_name,
            centre_location=centre_location,
            test_name=test_name,
            patient_email=patient_email,
            patient_name=patient_name,
        )

    @staticmethod
    async def create_booking(
        db: AsyncSession,
        current_user: User,
        payload: BookingCreateRequest,
    ) -> BookingResponse:
        """
        Creates a new diagnostic test booking in PENDING state.
        Snapshots the test price from CentreTest table at time of booking.
        Enforces availability, future appointment time, and active status.
        """
        # Resolve CentreTest association
        if payload.centre_test_id:
            query = (
                select(CentreTest)
                .options(selectinload(CentreTest.centre), selectinload(CentreTest.test))
                .where(CentreTest.id == payload.centre_test_id)
            )
        elif payload.centre_id and payload.test_id:
            query = (
                select(CentreTest)
                .options(selectinload(CentreTest.centre), selectinload(CentreTest.test))
                .where(
                    CentreTest.centre_id == payload.centre_id,
                    CentreTest.test_id == payload.test_id,
                )
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Must provide either 'centre_test_id' or both 'centre_id' and 'test_id'.",
            )

        result = await db.execute(query)
        centre_test = result.scalar_one_or_none()

        if not centre_test:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Selected diagnostic test is not offered at the specified centre.",
            )

        if not centre_test.is_available:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This diagnostic test is currently unavailable at this centre.",
            )

        if not centre_test.centre.is_active or not centre_test.test.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The diagnostic facility or test is currently inactive.",
            )

        # Snapshot price at creation time
        price_snapshot = centre_test.price

        booking = Booking(
            user_id=current_user.id,
            centre_test_id=centre_test.id,
            appointment_time=payload.appointment_time,
            amount=price_snapshot,
            status=BookingStatus.PENDING,
            notes=payload.notes.strip() if payload.notes else None,
        )

        db.add(booking)
        await db.commit()
        await db.refresh(booking)

        logger.info(
            "booking_created",
            booking_id=str(booking.id),
            user_id=str(current_user.id),
            amount=str(price_snapshot),
            status=booking.status.value,
        )

        # Re-fetch with relationships loaded
        return await BookingService.get_booking(db, booking.id, current_user)

    @staticmethod
    async def get_booking(
        db: AsyncSession,
        booking_id: uuid.UUID,
        current_user: User,
    ) -> BookingResponse:
        """
        Retrieves a booking. Enforces data isolation: Patients can only view their own bookings.
        """
        query = (
            select(Booking)
            .options(
                selectinload(Booking.user),
                selectinload(Booking.centre_test).selectinload(CentreTest.centre),
                selectinload(Booking.centre_test).selectinload(CentreTest.test),
            )
            .where(Booking.id == booking_id)
        )
        result = await db.execute(query)
        booking = result.scalar_one_or_none()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Booking with ID '{booking_id}' not found.",
            )

        # Data ownership verification
        if current_user.role != UserRole.ADMIN and booking.user_id != current_user.id:
            logger.warning(
                "unauthorized_booking_access_attempt",
                booking_id=str(booking_id),
                user_id=str(current_user.id),
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access this booking.",
            )

        return BookingService._to_response(booking)

    @staticmethod
    async def cancel_booking(
        db: AsyncSession,
        booking_id: uuid.UUID,
        current_user: User,
        payload: Optional[BookingCancelRequest] = None,
    ) -> BookingResponse:
        """
        Cancels a booking according to state-machine transition rules.
        Allowed from: PENDING, CONFIRMED (if appointment has not passed).
        Forbidden from: FAILED, CANCELLED.
        """
        query = (
            select(Booking)
            .options(
                selectinload(Booking.user),
                selectinload(Booking.centre_test).selectinload(CentreTest.centre),
                selectinload(Booking.centre_test).selectinload(CentreTest.test),
            )
            .where(Booking.id == booking_id)
        )
        result = await db.execute(query)
        booking = result.scalar_one_or_none()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Booking with ID '{booking_id}' not found.",
            )

        # Ownership check
        if current_user.role != UserRole.ADMIN and booking.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to cancel this booking.",
            )

        # State transition validation
        if booking.status == BookingStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This booking is already cancelled.",
            )

        if booking.status == BookingStatus.FAILED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot cancel a booking with FAILED status.",
            )

        # Time check: cannot cancel if appointment has already passed
        now_utc = datetime.now(timezone.utc)
        appointment_utc = booking.appointment_time if booking.appointment_time.tzinfo else booking.appointment_time.replace(tzinfo=timezone.utc)
        if appointment_utc <= now_utc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel an appointment that has already passed.",
            )

        # Apply state transition
        booking.status = BookingStatus.CANCELLED
        if payload and payload.reason:
            append_note = f"[Cancelled on {now_utc.isoformat()}: {payload.reason}]"
            booking.notes = f"{booking.notes}\n{append_note}" if booking.notes else append_note

        await db.commit()
        await db.refresh(booking)

        logger.info(
            "booking_cancelled",
            booking_id=str(booking_id),
            user_id=str(current_user.id),
        )
        return BookingService._to_response(booking)


booking_service = BookingService()

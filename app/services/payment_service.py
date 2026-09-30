from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import hmac
import random
from typing import Optional
import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.logging import logger
from app.models.booking import Booking, BookingStatus
from app.models.payment import Payment, PaymentStatus
from app.models.user import User, UserRole
from app.models.webhook_event import WebhookEvent, WebhookStatus
from app.schemas.payment import (
    PaymentCreateRequest,
    PaymentResponse,
    WebhookPayload,
    WebhookResponse,
)


class PaymentService:
    @staticmethod
    def generate_signature(payload_bytes: bytes, secret: Optional[str] = None) -> str:
        """
        Generates HMAC-SHA256 signature for the given payload bytes using WEBHOOK_SECRET.
        """
        key = (secret or settings.WEBHOOK_SECRET).encode("utf-8")
        return hmac.new(key, payload_bytes, hashlib.sha256).hexdigest()

    @staticmethod
    def verify_signature(
        payload_bytes: bytes,
        provided_signature: Optional[str],
        secret: Optional[str] = None,
    ) -> bool:
        """
        Performs constant-time HMAC-SHA256 signature verification.
        """
        if not provided_signature:
            return False
        expected_signature = PaymentService.generate_signature(payload_bytes, secret)
        return hmac.compare_digest(expected_signature, provided_signature.strip())

    async def create_payment(
        self,
        db: AsyncSession,
        current_user: User,
        payload: PaymentCreateRequest,
    ) -> PaymentResponse:
        """
        Simulates payment processing for a booking with strict idempotency and state machine transitions.
        """
        # 1. Idempotency Check: Check if a payment with this idempotency key already exists
        existing_payment_result = await db.execute(
            select(Payment).where(Payment.idempotency_key == payload.idempotency_key)
        )
        existing_payment = existing_payment_result.scalar_one_or_none()

        if existing_payment:
            # Verify user ownership of the associated booking
            booking = await db.get(Booking, existing_payment.booking_id)
            if booking and current_user.role != UserRole.ADMIN and booking.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have access to this payment.",
                )
            logger.info(
                "payment_idempotency_hit",
                idempotency_key=payload.idempotency_key,
                payment_id=str(existing_payment.id),
                status=existing_payment.status.value,
            )
            return PaymentResponse.model_validate(existing_payment)

        # 2. Retrieve Booking
        booking = await db.get(Booking, payload.booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Booking with ID '{payload.booking_id}' not found.",
            )

        # 3. Ownership Authorization Guard
        if current_user.role != UserRole.ADMIN and booking.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to pay for another user's booking.",
            )

        # 4. State Machine Verification: Can only pay for PENDING bookings
        if booking.status == BookingStatus.CONFIRMED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Booking is already confirmed and paid for.",
            )
        if booking.status == BookingStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot process payment for a cancelled booking.",
            )
        if booking.status == BookingStatus.FAILED:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot process payment for a failed booking.",
            )

        # 5. Check if booking already has a payment registered
        existing_booking_payment = await db.execute(
            select(Payment).where(Payment.booking_id == booking.id)
        )
        if existing_booking_payment.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A payment has already been recorded for this booking.",
            )

        # 6. Simulate Payment Outcome (Defaults to SUCCESS, or forced if provided)
        transaction_id = f"TXN-{uuid.uuid4().hex[:12].upper()}"

        if payload.force_status:
            payment_status = payload.force_status
        else:
            payment_status = PaymentStatus.SUCCESS

        failure_reason = None
        if payment_status == PaymentStatus.SUCCESS:
            booking.status = BookingStatus.CONFIRMED
        else:
            booking.status = BookingStatus.FAILED
            failure_reasons = [
                "Card declined by issuing bank.",
                "Insufficient funds in customer account.",
                "Simulated 3D-Secure authentication failure.",
                "Gateway timeout from simulated card processor.",
            ]
            failure_reason = random.choice(failure_reasons)

        # 7. Persist Payment Record
        payment = Payment(
            booking_id=booking.id,
            transaction_id=transaction_id,
            idempotency_key=payload.idempotency_key,
            provider="SIMULATED",
            amount=booking.amount,
            status=payment_status,
            failure_reason=failure_reason,
        )
        db.add(payment)
        try:
            await db.commit()
            await db.refresh(payment)
        except IntegrityError:
            await db.rollback()
            # If concurrent request already inserted with same idempotency_key
            existing_res = await db.execute(
                select(Payment).where(Payment.idempotency_key == payload.idempotency_key)
            )
            existing = existing_res.scalar_one_or_none()
            if existing:
                return PaymentResponse.model_validate(existing)
            raise

        logger.info(
            "simulated_payment_created",
            payment_id=str(payment.id),
            booking_id=str(booking.id),
            transaction_id=transaction_id,
            status=payment_status.value,
            amount=float(booking.amount),
        )

        return PaymentResponse.model_validate(payment)

    async def process_webhook(
        self,
        db: AsyncSession,
        raw_body: bytes,
        payload: WebhookPayload,
        signature_header: Optional[str] = None,
    ) -> WebhookResponse:
        """
        Processes simulated payment webhooks with cryptographic signature verification
        and database row-level locking (SELECT FOR UPDATE) to guarantee idempotency.
        """
        # 1. Cryptographic Signature Verification
        # Check header first, then fallback to payload signature field
        sig_to_verify = signature_header or payload.signature

        # Compute hash of raw request body or canonical string if body not available
        is_valid = False
        if sig_to_verify:
            # Try raw body match
            if self.verify_signature(raw_body, sig_to_verify):
                is_valid = True
            else:
                # Also verify over canonical event signature string (e.g., event_id:booking_id:status)
                canonical_data = f"{payload.event_id}:{payload.booking_id}:{payload.status.value}".encode("utf-8")
                if self.verify_signature(canonical_data, sig_to_verify):
                    is_valid = True

        if not is_valid:
            logger.warning(
                "webhook_invalid_signature",
                event_id=payload.event_id,
                has_header=bool(signature_header),
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature.",
            )

        # 2. Check Event Idempotency Ledger with Row Locking
        existing_event_res = await db.execute(
            select(WebhookEvent)
            .where(WebhookEvent.event_id == payload.event_id)
            .with_for_update()
        )
        existing_event = existing_event_res.scalar_one_or_none()

        if existing_event:
            logger.info(
                "webhook_idempotency_hit",
                event_id=payload.event_id,
                recorded_status=existing_event.status.value,
            )
            return WebhookResponse(
                status="already_processed",
                message="Webhook event has already been received and processed.",
                event_id=payload.event_id,
            )

        # 3. Retrieve Booking
        booking = await db.get(Booking, payload.booking_id)
        if not booking:
            webhook_event = WebhookEvent(
                event_id=payload.event_id,
                event_type=payload.event_type,
                payload=payload.model_dump(mode="json"),
                status=WebhookStatus.FAILED,
                processed_at=datetime.now(timezone.utc),
                retry_count=0,
            )
            db.add(webhook_event)
            try:
                await db.commit()
            except Exception:
                await db.rollback()
            logger.warning(
                "webhook_booking_not_found",
                event_id=payload.event_id,
                booking_id=str(payload.booking_id),
            )
            # Return 200 OK to provider to avoid perpetual retry loops for non-existent entities
            return WebhookResponse(
                status="booking_not_found",
                message=f"Referenced booking ID '{payload.booking_id}' does not exist.",
                event_id=payload.event_id,
            )

        # 4. Apply Status Transition
        if payload.status == PaymentStatus.SUCCESS:
            booking.status = BookingStatus.CONFIRMED
        else:
            # If already confirmed by previous action, do not degrade to failed unless desired
            if booking.status != BookingStatus.CONFIRMED:
                booking.status = BookingStatus.FAILED

        # 5. Update or Create Corresponding Payment Entry
        payment_res = await db.execute(
            select(Payment).where(Payment.booking_id == booking.id)
        )
        payment = payment_res.scalar_one_or_none()

        if payment:
            payment.status = payload.status
            if payload.failure_reason:
                payment.failure_reason = payload.failure_reason
        else:
            payment = Payment(
                booking_id=booking.id,
                transaction_id=payload.transaction_id,
                idempotency_key=f"webhook_{payload.event_id}",
                provider="SIMULATED",
                amount=booking.amount,
                status=payload.status,
                failure_reason=payload.failure_reason,
            )
            db.add(payment)

        # 6. Finalise Webhook Ledger Entry (Status: PROCESSED)
        webhook_event = WebhookEvent(
            event_id=payload.event_id,
            event_type=payload.event_type,
            payload=payload.model_dump(mode="json"),
            status=WebhookStatus.PROCESSED,
            processed_at=datetime.now(timezone.utc),
            retry_count=0,
        )
        db.add(webhook_event)

        try:
            await db.commit()
        except Exception as exc:
            await db.rollback()
            logger.info("webhook_concurrent_duplicate_handled", event_id=payload.event_id, error=str(exc))
            return WebhookResponse(
                status="already_processed",
                message="Webhook event has already been received and processed.",
                event_id=payload.event_id,
            )

        logger.info(
            "webhook_processed_successfully",
            event_id=payload.event_id,
            booking_id=str(booking.id),
            resulting_status=booking.status.value,
        )

        return WebhookResponse(
            status="processed",
            message=f"Webhook processed successfully. Booking status updated to {booking.status.value}.",
            event_id=payload.event_id,
        )

    async def get_payment(
        self,
        db: AsyncSession,
        payment_id: uuid.UUID,
        current_user: User,
    ) -> PaymentResponse:
        """
        Retrieves payment by ID, enforcing ownership restrictions for patients.
        """
        payment = await db.get(Payment, payment_id)
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Payment with ID '{payment_id}' not found.",
            )

        # Check ownership
        booking = await db.get(Booking, payment.booking_id)
        if booking and current_user.role != UserRole.ADMIN and booking.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view this payment.",
            )

        return PaymentResponse.model_validate(payment)

    async def get_payment_by_booking(
        self,
        db: AsyncSession,
        booking_id: uuid.UUID,
        current_user: User,
    ) -> PaymentResponse:
        """
        Retrieves payment record associated with a specific booking.
        """
        booking = await db.get(Booking, booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Booking with ID '{booking_id}' not found.",
            )

        if current_user.role != UserRole.ADMIN and booking.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to view this payment.",
            )

        result = await db.execute(select(Payment).where(Payment.booking_id == booking_id))
        payment = result.scalar_one_or_none()

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No payment record found for this booking.",
            )

        return PaymentResponse.model_validate(payment)


payment_service = PaymentService()

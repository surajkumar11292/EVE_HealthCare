from decimal import Decimal
import enum
import uuid
from sqlalchemy import Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class PaymentStatus(str, enum.Enum):
    PENDING = "PENDING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class Payment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "payments"

    booking_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("bookings.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )
    transaction_id: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True,
    )
    idempotency_key: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(
        String(50),
        default="SIMULATED",
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status_enum", native_enum=True),
        default=PaymentStatus.PENDING,
        nullable=False,
        index=True,
    )
    failure_reason: Mapped[str] = mapped_column(Text, nullable=True)

    # Relationships
    booking = relationship("Booking", back_populates="payment")

    def __repr__(self) -> str:
        return f"<Payment id={self.id} txn={self.transaction_id} status={self.status} amount={self.amount}>"

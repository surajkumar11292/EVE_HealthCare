from datetime import datetime
from decimal import Decimal
import enum
import uuid
from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class BookingStatus(str, enum.Enum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class Booking(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "bookings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    centre_test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centre_tests.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    appointment_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        comment="Snapshot of test price at the moment of booking",
    )
    status: Mapped[BookingStatus] = mapped_column(
        Enum(BookingStatus, name="booking_status_enum", native_enum=True),
        default=BookingStatus.PENDING,
        nullable=False,
        index=True,
    )
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    # Relationships
    user = relationship("User", back_populates="bookings")
    centre_test = relationship("CentreTest", back_populates="bookings")
    payment = relationship("Payment", back_populates="booking", uselist=False, cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Booking id={self.id} user_id={self.user_id} status={self.status} amount={self.amount}>"

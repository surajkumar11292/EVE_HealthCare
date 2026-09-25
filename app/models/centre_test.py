import uuid
from decimal import Decimal
from sqlalchemy import Boolean, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class CentreTest(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "centre_tests"
    __table_args__ = (
        UniqueConstraint("centre_id", "test_id", name="uq_centre_test"),
    )

    centre_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centres.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    test_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("diagnostic_tests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    centre = relationship("Centre", back_populates="centre_tests")
    test = relationship("DiagnosticTest", back_populates="centre_tests")
    bookings = relationship("Booking", back_populates="centre_test")

    def __repr__(self) -> str:
        return f"<CentreTest id={self.id} centre_id={self.centre_id} test_id={self.test_id} price={self.price}>"

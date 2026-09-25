from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class Centre(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "centres"

    name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    location: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    contact_number: Mapped[str] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    centre_tests = relationship("CentreTest", back_populates="centre", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Centre id={self.id} name={self.name} location={self.location}>"

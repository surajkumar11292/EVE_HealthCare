from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin


class DiagnosticTest(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "diagnostic_tests"

    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), index=True, default="General", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    centre_tests = relationship("CentreTest", back_populates="test", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<DiagnosticTest id={self.id} name={self.name} category={self.category}>"

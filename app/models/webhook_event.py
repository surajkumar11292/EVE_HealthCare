from datetime import datetime
import enum
from sqlalchemy import DateTime, Enum, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDMixin


class WebhookStatus(str, enum.Enum):
    PROCESSING = "PROCESSING"
    PROCESSED = "PROCESSED"
    DUPLICATE = "DUPLICATE"
    FAILED = "FAILED"


class WebhookEvent(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "webhook_events"

    event_id: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    payload: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False,
    )
    status: Mapped[WebhookStatus] = mapped_column(
        Enum(WebhookStatus, name="webhook_status_enum", native_enum=True),
        default=WebhookStatus.PROCESSING,
        nullable=False,
        index=True,
    )
    retry_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    def __repr__(self) -> str:
        return f"<WebhookEvent id={self.id} event_id={self.event_id} status={self.status}>"

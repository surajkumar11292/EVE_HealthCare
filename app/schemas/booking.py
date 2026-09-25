from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.booking import BookingStatus
from app.schemas.centre import CentreResponse
from app.schemas.test import TestResponse


class BookingCreateRequest(BaseModel):
    centre_id: Optional[uuid.UUID] = Field(None, description="Diagnostic centre ID (required if centre_test_id omitted)")
    test_id: Optional[uuid.UUID] = Field(None, description="Diagnostic test ID (required if centre_test_id omitted)")
    centre_test_id: Optional[uuid.UUID] = Field(None, description="Direct Centre-Test association ID")
    appointment_time: datetime = Field(..., description="Desired appointment date and time (must be in the future, ISO-8601)")
    notes: Optional[str] = Field(None, max_length=500, description="Optional clinical notes or symptoms")

    @field_validator("appointment_time")
    @classmethod
    def validate_future_date(cls, v: datetime) -> datetime:
        # Normalize timezone
        now_utc = datetime.now(timezone.utc)
        appointment_utc = v if v.tzinfo else v.replace(tzinfo=timezone.utc)

        if appointment_utc <= now_utc:
            raise ValueError("Appointment date and time must be strictly in the future.")
        return appointment_utc


class BookingCancelRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=255, description="Reason for cancellation")


class BookingResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    centre_test_id: uuid.UUID
    appointment_time: datetime
    amount: Decimal
    status: BookingStatus
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    centre_name: Optional[str] = None
    centre_location: Optional[str] = None
    test_name: Optional[str] = None
    patient_email: Optional[str] = None
    patient_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

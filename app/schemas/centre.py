from datetime import datetime
from decimal import Decimal
from typing import List, Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.test import TestResponse


class CentreCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Diagnostic centre name")
    location: str = Field(..., min_length=2, max_length=255, description="City/locality location")
    contact_number: Optional[str] = Field(None, max_length=50, description="Phone contact")


class CentreUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    location: Optional[str] = Field(None, min_length=2, max_length=255)
    contact_number: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = None


class CentreTestLinkRequest(BaseModel):
    test_id: uuid.UUID = Field(..., description="UUID of diagnostic test to link")
    price: Decimal = Field(..., ge=0, decimal_places=2, description="Price charged at this centre (INR)")
    is_available: bool = Field(default=True, description="Whether test is currently offered")


class CentreTestUpdatePriceRequest(BaseModel):
    price: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    is_available: Optional[bool] = None


class CentreTestResponse(BaseModel):
    id: uuid.UUID
    centre_id: uuid.UUID
    test_id: uuid.UUID
    price: Decimal
    is_available: bool
    test: Optional[TestResponse] = None

    model_config = ConfigDict(from_attributes=True)


class CentreResponse(BaseModel):
    id: uuid.UUID
    name: str
    location: str
    contact_number: Optional[str]
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CentreDetailResponse(CentreResponse):
    tests: List[CentreTestResponse] = Field(default=[], validation_alias="centre_tests")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

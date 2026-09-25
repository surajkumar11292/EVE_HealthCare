from datetime import datetime
from typing import Optional
import uuid
from pydantic import BaseModel, ConfigDict, Field


class TestCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Unique name of diagnostic test")
    description: Optional[str] = Field(None, description="Detailed description of diagnostic test")
    category: str = Field(default="General", max_length=100, description="Medical category")


class TestUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None


class TestResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    category: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

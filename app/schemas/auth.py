from datetime import datetime
import re
import uuid
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.user import UserRole

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class UserSignUpRequest(BaseModel):
    email: str = Field(..., description="Unique email address of the user")
    full_name: str = Field(..., min_length=2, max_length=255, description="Full legal name")
    password: str = Field(
        ...,
        min_length=8,
        max_length=72,
        description="Password must be 8-72 characters with at least one number and one letter",
    )
    role: UserRole = Field(default=UserRole.PATIENT, description="User role: PATIENT or ADMIN")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email format.")
        return clean

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one numerical digit.")
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("Password must contain at least one letter.")
        return v


class UserLoginRequest(BaseModel):
    email: str = Field(..., description="User's registered email address")
    password: str = Field(..., description="User's account password")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, v: str) -> str:
        clean = v.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email format.")
        return clean


class TokenResponse(BaseModel):
    access_token: str = Field(..., description="JWT Bearer token")
    token_type: str = Field(default="bearer", description="Token type")
    expires_in: int = Field(..., description="Expiry time in seconds")


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

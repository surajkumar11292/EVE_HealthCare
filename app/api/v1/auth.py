from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import TokenResponse, UserLoginRequest, UserResponse, UserSignUpRequest
from app.services.auth_service import auth_service

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/signup",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
    description="Registers a patient or admin user. Enforces email uniqueness and password strength.",
)
async def signup(
    payload: UserSignUpRequest,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    user = await auth_service.register_user(db, payload)
    return user


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate and receive JWT token",
    description="Validates email and password, returning a signed JWT access token for subsequent authenticated requests.",
)
async def login(
    payload: UserLoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    token_response = await auth_service.authenticate_user(db, payload)
    return token_response


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile",
    description="Returns the profile details of the user associated with the provided JWT bearer token.",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    return current_user

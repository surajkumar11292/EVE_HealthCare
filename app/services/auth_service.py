from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.auth import TokenResponse, UserLoginRequest, UserSignUpRequest
from app.core.logging import logger


class AuthService:
    @staticmethod
    async def register_user(db: AsyncSession, payload: UserSignUpRequest) -> User:
        """
        Registers a new user. Enforces email uniqueness and secure password hashing.
        """
        normalized_email = payload.email.strip().lower()

        # Check existing user
        existing_result = await db.execute(select(User).where(User.email == normalized_email))
        if existing_result.scalar_one_or_none():
            logger.warning("auth_registration_failed_duplicate_email", email=normalized_email)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email address already exists.",
            )

        hashed_pw = get_password_hash(payload.password)
        new_user = User(
            email=normalized_email,
            full_name=payload.full_name.strip(),
            hashed_password=hashed_pw,
            role=payload.role,
            is_active=True,
        )

        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)

        logger.info("auth_user_registered", user_id=str(new_user.id), email=new_user.email, role=new_user.role.value)
        return new_user

    @staticmethod
    async def authenticate_user(db: AsyncSession, payload: UserLoginRequest) -> TokenResponse:
        """
        Authenticates user credentials and issues a signed JWT access token.
        """
        normalized_email = payload.email.strip().lower()

        result = await db.execute(select(User).where(User.email == normalized_email))
        user = result.scalar_one_or_none()

        if not user or not verify_password(payload.password, user.hashed_password):
            logger.warning("auth_login_failed_invalid_credentials", email=normalized_email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            logger.warning("auth_login_failed_inactive_user", email=normalized_email)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account is deactivated.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        access_token = create_access_token(
            subject=str(user.id),
            extra_claims={
                "email": user.email,
                "role": user.role.value,
            },
        )

        logger.info("auth_login_successful", user_id=str(user.id), email=user.email)
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )


auth_service = AuthService()

from datetime import datetime, timedelta, timezone
from decimal import Decimal
import uuid
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token, get_password_hash
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.booking import Booking, BookingStatus
from app.models.centre import Centre
from app.models.centre_test import CentreTest
from app.models.test import DiagnosticTest
from app.models.user import User, UserRole


# Use an in-memory SQLite DB with StaticPool for fast, isolated async testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest_asyncio.fixture(scope="function")
async def db_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession):
    async def override_get_db():
        async with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    user = User(
        email="admin@test.com",
        full_name="Admin Tester",
        hashed_password=get_password_hash("AdminPass123!"),
        role=UserRole.ADMIN,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
def admin_headers(admin_user: User) -> dict:
    token = create_access_token(
        subject=str(admin_user.id),
        extra_claims={"email": admin_user.email, "role": admin_user.role.value},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def patient_user(db_session: AsyncSession) -> User:
    user = User(
        email="patient@test.com",
        full_name="Patient Jane",
        hashed_password=get_password_hash("PatientPass123!"),
        role=UserRole.PATIENT,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
def patient_headers(patient_user: User) -> dict:
    token = create_access_token(
        subject=str(patient_user.id),
        extra_claims={"email": patient_user.email, "role": patient_user.role.value},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def other_patient_user(db_session: AsyncSession) -> User:
    user = User(
        email="other@test.com",
        full_name="Other Patient",
        hashed_password=get_password_hash("OtherPass123!"),
        role=UserRole.PATIENT,
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
def other_patient_headers(other_patient_user: User) -> dict:
    token = create_access_token(
        subject=str(other_patient_user.id),
        extra_claims={"email": other_patient_user.email, "role": other_patient_user.role.value},
    )
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def sample_centre(db_session: AsyncSession) -> Centre:
    centre = Centre(
        name="Apex Diagnostics",
        location="South Mumbai",
        contact_number="+91-22-99990000",
        is_active=True,
    )
    db_session.add(centre)
    await db_session.commit()
    await db_session.refresh(centre)
    return centre


@pytest_asyncio.fixture
async def sample_test(db_session: AsyncSession) -> DiagnosticTest:
    test = DiagnosticTest(
        name="HbA1c Blood Test",
        description="Glycated hemoglobin test for diabetes management",
        category="Endocrinology",
        is_active=True,
    )
    db_session.add(test)
    await db_session.commit()
    await db_session.refresh(test)
    return test


@pytest_asyncio.fixture
async def sample_centre_test(
    db_session: AsyncSession, sample_centre: Centre, sample_test: DiagnosticTest
) -> CentreTest:
    ct = CentreTest(
        centre_id=sample_centre.id,
        test_id=sample_test.id,
        price=Decimal("450.00"),
        is_available=True,
    )
    db_session.add(ct)
    await db_session.commit()
    await db_session.refresh(ct)
    return ct


@pytest_asyncio.fixture
async def sample_booking(
    db_session: AsyncSession, patient_user: User, sample_centre_test: CentreTest
) -> Booking:
    future_time = datetime.now(timezone.utc) + timedelta(days=2)
    booking = Booking(
        user_id=patient_user.id,
        centre_test_id=sample_centre_test.id,
        appointment_time=future_time,
        amount=sample_centre_test.price,
        status=BookingStatus.PENDING,
        notes="Please call before appointment",
    )
    db_session.add(booking)
    await db_session.commit()
    await db_session.refresh(booking)
    return booking

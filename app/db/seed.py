import asyncio
from decimal import Decimal
from passlib.context import CryptContext
from sqlalchemy import select

from app.db.session import AsyncSessionLocal, engine
from app.db.base import Base
from app.models.user import User, UserRole
from app.models.centre import Centre
from app.models.test import DiagnosticTest
from app.models.centre_test import CentreTest
from app.core.logging import logger

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed_database() -> None:
    """
    Populates initial diagnostic centres, tests, pricing, and demo accounts.
    Idempotent: will skip if records already exist.
    """
    async with engine.begin() as conn:
        # Create tables directly if running standalone without migrations
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        # 1. Seed Users (Admin & Patient)
        existing_users = await session.execute(select(User))
        if not existing_users.scalars().first():
            admin_user = User(
                email="admin@evehealthcare.com",
                full_name="EVE System Administrator",
                hashed_password=pwd_context.hash("Admin@12345"),
                role=UserRole.ADMIN,
                is_active=True,
            )
            patient_user = User(
                email="patient@evehealthcare.com",
                full_name="John Doe",
                hashed_password=pwd_context.hash("Patient@12345"),
                role=UserRole.PATIENT,
                is_active=True,
            )
            session.add_all([admin_user, patient_user])
            logger.info("seed_users_created", count=2)

        # 2. Seed Diagnostic Centres
        existing_centres = await session.execute(select(Centre))
        centres = existing_centres.scalars().all()
        if not centres:
            centres = [
                Centre(
                    name="Apollo Diagnostics",
                    location="Mumbai, Maharashtra",
                    contact_number="+91-22-28491000",
                    is_active=True,
                ),
                Centre(
                    name="Dr. Lal PathLabs",
                    location="New Delhi, Delhi",
                    contact_number="+91-11-39885050",
                    is_active=True,
                ),
                Centre(
                    name="SRL Diagnostics",
                    location="Bengaluru, Karnataka",
                    contact_number="+91-80-45678900",
                    is_active=True,
                ),
            ]
            session.add_all(centres)
            await session.flush()
            logger.info("seed_centres_created", count=len(centres))

        # 3. Seed Diagnostic Tests
        existing_tests = await session.execute(select(DiagnosticTest))
        tests = existing_tests.scalars().all()
        if not tests:
            tests = [
                DiagnosticTest(
                    name="Complete Blood Count (CBC)",
                    description="Measures red blood cells, white blood cells, hemoglobin, and platelets.",
                    category="Hematology",
                    is_active=True,
                ),
                DiagnosticTest(
                    name="Lipid Profile",
                    description="Measures cholesterol levels including HDL, LDL, and triglycerides.",
                    category="Cardiology",
                    is_active=True,
                ),
                DiagnosticTest(
                    name="Fasting Blood Glucose",
                    description="Screening test for prediabetes and diabetes.",
                    category="Endocrinology",
                    is_active=True,
                ),
                DiagnosticTest(
                    name="Thyroid Profile (Total T3, T4, TSH)",
                    description="Evaluates thyroid gland function and hormone levels.",
                    category="Endocrinology",
                    is_active=True,
                ),
                DiagnosticTest(
                    name="MRI Brain",
                    description="High-resolution magnetic resonance imaging of brain anatomy.",
                    category="Radiology",
                    is_active=True,
                ),
                DiagnosticTest(
                    name="Digital Chest X-Ray",
                    description="Radiographic evaluation of lungs, heart, and chest wall.",
                    category="Radiology",
                    is_active=True,
                ),
            ]
            session.add_all(tests)
            await session.flush()
            logger.info("seed_tests_created", count=len(tests))

        # 4. Seed Centre Test Associations with Pricing
        existing_ct = await session.execute(select(CentreTest))
        if not existing_ct.scalars().first():
            # Standard price map per test name
            price_map = {
                "Complete Blood Count (CBC)": Decimal("350.00"),
                "Lipid Profile": Decimal("850.00"),
                "Fasting Blood Glucose": Decimal("200.00"),
                "Thyroid Profile (Total T3, T4, TSH)": Decimal("650.00"),
                "MRI Brain": Decimal("5500.00"),
                "Digital Chest X-Ray": Decimal("750.00"),
            }

            centre_tests = []
            for centre in centres:
                for test in tests:
                    # Slight price variation between centres
                    base_price = price_map[test.name]
                    multiplier = Decimal("1.0") if "Apollo" in centre.name else (
                        Decimal("0.95") if "Lal" in centre.name else Decimal("1.05")
                    )
                    final_price = round(base_price * multiplier, 2)

                    centre_tests.append(
                        CentreTest(
                            centre_id=centre.id,
                            test_id=test.id,
                            price=final_price,
                            is_available=True,
                        )
                    )
            session.add_all(centre_tests)
            logger.info("seed_centre_tests_created", count=len(centre_tests))

        await session.commit()
        logger.info("database_seeding_completed_successfully")


if __name__ == "__main__":
    asyncio.run(seed_database())

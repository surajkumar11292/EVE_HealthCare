"""
EVE Healthcare — Database Seeder Script
Populates the database with initial Admin, Patient, Diagnostic Centres, Diagnostic Tests,
Linked CentreTests with prices, and sample Bookings/Payments for local and Docker testing.

Usage:
    python scripts/seed.py
    docker compose exec web python scripts/seed.py
"""

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import sys
import os

# Ensure project root is in python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import select
from app.db.base import Base
from app.db.session import engine, AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.test import DiagnosticTest
from app.models.centre import Centre
from app.models.centre_test import CentreTest
from app.models.booking import Booking, BookingStatus
from app.models.payment import Payment, PaymentStatus


async def seed_database():
    print("=" * 70)
    print("  EVE HEALTHCARE — INITIAL DATABASE SEEDING")
    print("=" * 70)

    # 1. Ensure all tables are created
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[+] Database tables verified.")

    async with AsyncSessionLocal() as session:
        # 2. Seed Users
        print("\n[*] Checking Users...")
        # Admin
        res_admin = await session.execute(
            select(User).where(User.email == "admin@evehealthcare.com")
        )
        admin_user = res_admin.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                email="admin@evehealthcare.com",
                hashed_password=get_password_hash("Admin@123456"),
                full_name="System Administrator",
                role=UserRole.ADMIN,
                phone_number="+919876543210",
                is_active=True,
            )
            session.add(admin_user)
            await session.flush()
            print("    [+] Created Admin: admin@evehealthcare.com / Admin@123456")
        else:
            admin_user.hashed_password = get_password_hash("Admin@123456")
            admin_user.role = UserRole.ADMIN
            admin_user.is_active = True
            await session.flush()
            print("    [+] Synced Admin credentials: admin@evehealthcare.com / Admin@123456")

        # Patient
        res_patient = await session.execute(
            select(User).where(User.email == "patient@evehealthcare.com")
        )
        patient_user = res_patient.scalar_one_or_none()
        if not patient_user:
            patient_user = User(
                email="patient@evehealthcare.com",
                hashed_password=get_password_hash("Patient@123456"),
                full_name="John Doe",
                role=UserRole.PATIENT,
                phone_number="+919876543211",
                is_active=True,
            )
            session.add(patient_user)
            await session.flush()
            print("    [+] Created Patient: patient@evehealthcare.com / Patient@123456")
        else:
            patient_user.hashed_password = get_password_hash("Patient@123456")
            patient_user.role = UserRole.PATIENT
            patient_user.is_active = True
            await session.flush()
            print("    [+] Synced Patient credentials: patient@evehealthcare.com / Patient@123456")

        # 3. Seed Diagnostic Tests
        print("\n[*] Checking Diagnostic Tests...")
        tests_data = [
            {
                "name": "Complete Blood Count (CBC)",
                "category": "Hematology",
                "description": "Standard panel evaluating red blood cells, white blood cells, and platelets.",
            },
            {
                "name": "Lipid Profile",
                "category": "Biochemistry",
                "description": "Measures total cholesterol, HDL, LDL, and triglycerides for cardiovascular risk.",
            },
            {
                "name": "Thyroid Stimulating Hormone (TSH)",
                "category": "Endocrinology",
                "description": "Evaluates thyroid gland function and metabolic regulation.",
            },
            {
                "name": "HbA1c (Glycated Hemoglobin)",
                "category": "Diabetes",
                "description": "Monitors 3-month average blood glucose levels for diabetes assessment.",
            },
            {
                "name": "Vitamin D3 (25-OH)",
                "category": "Special Chemistry",
                "description": "Assesses vitamin D sufficiency essential for bone health and immunity.",
            },
            {
                "name": "Liver Function Test (LFT)",
                "category": "Biochemistry",
                "description": "Evaluates liver enzymes (ALT, AST, ALP), bilirubin, and protein synthesis.",
            },
        ]

        created_tests = {}
        for td in tests_data:
            stmt = select(DiagnosticTest).where(DiagnosticTest.name == td["name"])
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                test_obj = DiagnosticTest(
                    name=td["name"],
                    category=td["category"],
                    description=td["description"],
                    is_active=True,
                )
                session.add(test_obj)
                await session.flush()
                created_tests[td["name"]] = test_obj
                print(f"    [+] Created Test: {td['name']} ({td['category']})")
            else:
                created_tests[td["name"]] = existing
                print(f"    [-] Test exists: {td['name']}")

        # 4. Seed Diagnostic Centres
        print("\n[*] Checking Diagnostic Centres...")
        centres_data = [
            {
                "name": "Apex Diagnostic & Imaging Hub",
                "location": "12th Main, Indiranagar, Bangalore",
                "contact_number": "+918012345678",
            },
            {
                "name": "CarePlus Pathology & Wellness Centre",
                "location": "Linking Road, Bandra West, Mumbai",
                "contact_number": "+912212345678",
            },
            {
                "name": "Metropolis Diagnostics Capital",
                "location": "Barakhamba Road, Connaught Place, New Delhi",
                "contact_number": "+911112345678",
            },
        ]

        created_centres = {}
        for cd in centres_data:
            stmt = select(Centre).where(Centre.name == cd["name"])
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if not existing:
                centre_obj = Centre(
                    name=cd["name"],
                    location=cd["location"],
                    contact_number=cd["contact_number"],
                    is_active=True,
                )
                session.add(centre_obj)
                await session.flush()
                created_centres[cd["name"]] = centre_obj
                print(f"    [+] Created Centre: {cd['name']} ({cd['location']})")
            else:
                created_centres[cd["name"]] = existing
                print(f"    [-] Centre exists: {cd['name']}")

        # 5. Link Tests to Centres (CentreTest) with Realistic Pricing
        print("\n[*] Linking Diagnostic Tests to Centres...")
        centre_test_links = [
            # Apex (Bangalore)
            ("Apex Diagnostic & Imaging Hub", "Complete Blood Count (CBC)", Decimal("450.00")),
            ("Apex Diagnostic & Imaging Hub", "Lipid Profile", Decimal("850.00")),
            ("Apex Diagnostic & Imaging Hub", "Thyroid Stimulating Hormone (TSH)", Decimal("550.00")),
            ("Apex Diagnostic & Imaging Hub", "HbA1c (Glycated Hemoglobin)", Decimal("650.00")),
            # CarePlus (Mumbai)
            ("CarePlus Pathology & Wellness Centre", "Complete Blood Count (CBC)", Decimal("500.00")),
            ("CarePlus Pathology & Wellness Centre", "Lipid Profile", Decimal("900.00")),
            ("CarePlus Pathology & Wellness Centre", "Vitamin D3 (25-OH)", Decimal("1200.00")),
            ("CarePlus Pathology & Wellness Centre", "Liver Function Test (LFT)", Decimal("750.00")),
            # Metropolis (Delhi)
            ("Metropolis Diagnostics Capital", "Complete Blood Count (CBC)", Decimal("480.00")),
            ("Metropolis Diagnostics Capital", "Thyroid Stimulating Hormone (TSH)", Decimal("600.00")),
            ("Metropolis Diagnostics Capital", "HbA1c (Glycated Hemoglobin)", Decimal("700.00")),
            ("Metropolis Diagnostics Capital", "Vitamin D3 (25-OH)", Decimal("1300.00")),
            ("Metropolis Diagnostics Capital", "Liver Function Test (LFT)", Decimal("800.00")),
        ]

        seeded_centre_tests = {}
        for c_name, t_name, price in centre_test_links:
            c = created_centres[c_name]
            t = created_tests[t_name]
            stmt = select(CentreTest).where(
                CentreTest.centre_id == c.id,
                CentreTest.test_id == t.id,
            )
            existing_link = (await session.execute(stmt)).scalar_one_or_none()
            if not existing_link:
                ct = CentreTest(
                    centre_id=c.id,
                    test_id=t.id,
                    price=price,
                    is_available=True,
                )
                session.add(ct)
                await session.flush()
                seeded_centre_tests[(c_name, t_name)] = ct
                print(f"    [+] Linked {t_name} to {c_name} at INR {price}")
            else:
                seeded_centre_tests[(c_name, t_name)] = existing_link
                print(f"    [-] Already linked {t_name} to {c_name}")

        # 6. Seed Sample Bookings & Payments
        print("\n[*] Checking Sample Bookings...")
        # Sample 1: PENDING Booking for CBC at Apex
        pending_ct = seeded_centre_tests.get(("Apex Diagnostic & Imaging Hub", "Complete Blood Count (CBC)"))
        if pending_ct:
            stmt = select(Booking).where(
                Booking.user_id == patient_user.id,
                Booking.centre_test_id == pending_ct.id,
                Booking.status == BookingStatus.PENDING,
            )
            existing_pending = (await session.execute(stmt)).scalar_one_or_none()
            if not existing_pending:
                booking_pending = Booking(
                    user_id=patient_user.id,
                    centre_test_id=pending_ct.id,
                    appointment_time=datetime.now(timezone.utc) + timedelta(days=2),
                    amount=pending_ct.price,
                    status=BookingStatus.PENDING,
                    notes="Fasting required before 8 AM",
                )
                session.add(booking_pending)
                await session.flush()
                print(f"    [+] Created PENDING Booking (ID: {booking_pending.id}) for INR {booking_pending.amount}")

        # Sample 2: CONFIRMED Booking with SUCCESS Payment
        confirmed_ct = seeded_centre_tests.get(("CarePlus Pathology & Wellness Centre", "Lipid Profile"))
        if confirmed_ct:
            stmt = select(Booking).where(
                Booking.user_id == patient_user.id,
                Booking.centre_test_id == confirmed_ct.id,
                Booking.status == BookingStatus.CONFIRMED,
            )
            existing_confirmed = (await session.execute(stmt)).scalar_one_or_none()
            if not existing_confirmed:
                booking_confirmed = Booking(
                    user_id=patient_user.id,
                    centre_test_id=confirmed_ct.id,
                    appointment_time=datetime.now(timezone.utc) + timedelta(days=5),
                    amount=confirmed_ct.price,
                    status=BookingStatus.CONFIRMED,
                    notes="Pre-paid routine annual checkup",
                )
                session.add(booking_confirmed)
                await session.flush()

                # Associated Payment record
                payment_record = Payment(
                    booking_id=booking_confirmed.id,
                    transaction_id="TXN-SEED-SAMPLE-001",
                    idempotency_key="SEED-PAYMENT-IDEMP-001",
                    provider="SIMULATED",
                    amount=confirmed_ct.price,
                    status=PaymentStatus.SUCCESS,
                )
                session.add(payment_record)
                await session.flush()
                print(f"    [+] Created CONFIRMED Booking (ID: {booking_confirmed.id}) with Payment (TXN: {payment_record.transaction_id})")

        # Commit all changes
        await session.commit()

    print("\n" + "=" * 70)
    print("  SEEDING COMPLETE — CREDENTIALS & DEMO ACCESS")
    print("=" * 70)
    print("  ADMIN USER:")
    print("    Email:    admin@evehealthcare.com")
    print("    Password: Admin@123456")
    print("    Role:     ADMIN")
    print("-" * 70)
    print("  PATIENT USER:")
    print("    Email:    patient@evehealthcare.com")
    print("    Password: Patient@123456")
    print("    Role:     PATIENT")
    print("-" * 70)
    print("  SWAGGER DOCUMENTATION:")
    print("    http://localhost:8000/docs")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(seed_database())

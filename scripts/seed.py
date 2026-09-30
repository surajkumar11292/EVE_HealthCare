"""
EVE Healthcare — Comprehensive Database Seeder Script
Populates the database with:
- 1 Administrator & 3 distinct Patient accounts
- 20 Diagnostic Tests across clinical categories
- 16 Premier Diagnostic Centres across 6 major Indian metropolitan hubs
- 130+ Centre-Test links with realistic tiered pricing (Total records: 170+)
- Sample Bookings across diverse workflow states (PENDING, CONFIRMED, CANCELLED)

Usage:
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
    print("=" * 75)
    print("  EVE HEALTHCARE — HIGH-DENSITY DATABASE SEEDER (100+ RECORDS)")
    print("=" * 75)

    # 1. Ensure all tables are created
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[+] Database tables verified.")

    async with AsyncSessionLocal() as session:
        # ---------------------------------------------------------
        # 2. Seed Users (1 Admin + 3 Patients)
        # ---------------------------------------------------------
        print("\n[*] Seeding Users (1 Admin + 3 Patients)...")
        users_to_seed = [
            {
                "email": "admin@evehealthcare.com",
                "password": "Admin@123456",
                "full_name": "Dr. Rohan Mehra (Lab Administrator)",
                "role": UserRole.ADMIN,
                "phone": "+919876543210",
            },
            {
                "email": "patient@evehealthcare.com",
                "password": "Patient@123456",
                "full_name": "Suraj Kumar (Patient #1)",
                "role": UserRole.PATIENT,
                "phone": "+919876543211",
            },
            {
                "email": "patient2@evehealthcare.com",
                "password": "Patient@123456",
                "full_name": "Ananya Sharma (Patient #2)",
                "role": UserRole.PATIENT,
                "phone": "+919876543212",
            },
            {
                "email": "patient3@evehealthcare.com",
                "password": "Patient@123456",
                "full_name": "Rajesh Patel (Patient #3)",
                "role": UserRole.PATIENT,
                "phone": "+919876543213",
            },
        ]

        seeded_users = {}
        for u_data in users_to_seed:
            res = await session.execute(select(User).where(User.email == u_data["email"]))
            existing = res.scalar_one_or_none()
            if not existing:
                u_obj = User(
                    email=u_data["email"],
                    hashed_password=get_password_hash(u_data["password"]),
                    full_name=u_data["full_name"],
                    role=u_data["role"],
                    is_active=True,
                )
                session.add(u_obj)
                await session.flush()
                seeded_users[u_data["email"]] = u_obj
                print(f"    [+] Created User: {u_data['email']} ({u_data['full_name']})")
            else:
                existing.hashed_password = get_password_hash(u_data["password"])
                existing.full_name = u_data["full_name"]
                existing.role = u_data["role"]
                existing.is_active = True
                await session.flush()
                seeded_users[u_data["email"]] = existing
                print(f"    [*] Synced User: {u_data['email']}")

        # ---------------------------------------------------------
        # 3. Seed Diagnostic Tests (20 Comprehensive Tests)
        # ---------------------------------------------------------
        print("\n[*] Seeding Diagnostic Tests (20 Tests)...")
        tests_data = [
            {
                "name": "Complete Blood Count (CBC)",
                "category": "Hematology",
                "description": "Evaluates red blood cells, white blood cells, hemoglobin, hematocrit, and platelets.",
            },
            {
                "name": "Lipid Profile",
                "category": "Biochemistry",
                "description": "Measures total cholesterol, HDL, LDL, VLDL, and triglycerides for cardiovascular risk assessment.",
            },
            {
                "name": "Thyroid Stimulating Hormone (TSH)",
                "category": "Endocrinology",
                "description": "Screens for hypothyroidism and hyperthyroidism, regulating systemic metabolic rate.",
            },
            {
                "name": "HbA1c (Glycated Hemoglobin)",
                "category": "Diabetes Care",
                "description": "Measures average blood sugar levels over the past 90 days for glycemic control.",
            },
            {
                "name": "Vitamin D3 & B12 Combo",
                "category": "Special Chemistry",
                "description": "Evaluates bone health, neurological nerve function, and cellular energy synthesis.",
            },
            {
                "name": "Liver Function Test (LFT)",
                "category": "Biochemistry",
                "description": "Evaluates SGOT/AST, SGPT/ALT, alkaline phosphatase, bilirubin, and total protein levels.",
            },
            {
                "name": "Kidney Function Test (KFT)",
                "category": "Renal Health",
                "description": "Measures serum creatinine, blood urea nitrogen (BUN), uric acid, and electrolytes.",
            },
            {
                "name": "Full Body Comprehensive Health Package",
                "category": "Executive Wellness",
                "description": "Master 75-parameter checkup covering CBC, Lipids, Liver, Kidney, Thyroid, and Diabetes markers.",
            },
            {
                "name": "Fasting Blood Sugar (FBS)",
                "category": "Diabetes Care",
                "description": "Baseline glucose measurement after minimum 8-10 hours overnight fasting.",
            },
            {
                "name": "Urine Routine & Microscopy",
                "category": "Clinical Pathology",
                "description": "Screens for urinary tract infections, renal disease, proteinuria, and hematuria.",
            },
            {
                "name": "Cardiac Risk Markers Panel",
                "category": "Cardiology",
                "description": "High-sensitivity CRP (hs-CRP), homocysteine, and apolipoprotein A1/B screening.",
            },
            {
                "name": "Serum Ferritin & Iron Panel",
                "category": "Hematology",
                "description": "Evaluates iron deficiency, anemia etiology, and systemic iron saturation capacity.",
            },
            {
                "name": "Serum Electrolytes (Na, K, Cl)",
                "category": "Biochemistry",
                "description": "Measures sodium, potassium, and chloride balances critical for cardiac and cellular function.",
            },
            {
                "name": "Dengue NS1 Antigen & Antibody Panel",
                "category": "Serology",
                "description": "Rapid detection of Dengue viral antigen and IgG/IgM antibodies during fever onset.",
            },
            {
                "name": "COVID-19 RT-PCR Test",
                "category": "Molecular Diagnostics",
                "description": "Gold standard molecular assay for qualitative SARS-CoV-2 viral RNA detection.",
            },
            {
                "name": "C-Reactive Protein (CRP) Quantitative",
                "category": "Immunology",
                "description": "Sensitive marker of systemic bacterial inflammation, tissue trauma, and infection.",
            },
            {
                "name": "Allergy Screening Panel (30 Allergens)",
                "category": "Immunology",
                "description": "Circulating IgE antibody screening for common food items and airborne inhalants.",
            },
            {
                "name": "Prostate Specific Antigen (PSA) Total",
                "category": "Tumor Markers",
                "description": "Screening marker for benign prostatic hyperplasia and prostate adenocarcinoma.",
            },
            {
                "name": "Serum Calcium & Phosphorus",
                "category": "Bone Mineral",
                "description": "Evaluates parathyroid function, bone density homeostasis, and calcium balance.",
            },
            {
                "name": "Beta HCG Quantitative",
                "category": "Endocrinology",
                "description": "Accurate hormone measurement for pregnancy confirmation and obstetric monitoring.",
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
                print(f"    [+] Created Test: {td['name']}")
            else:
                created_tests[td["name"]] = existing

        # ---------------------------------------------------------
        # 4. Seed Diagnostic Centres (16 Centres in 6 Cities)
        # ---------------------------------------------------------
        print("\n[*] Seeding Diagnostic Centres (16 Centres in 6 Cities)...")
        centres_data = [
            # Bangalore (4 centres)
            {
                "name": "Apex Diagnostic & Imaging Hub",
                "location": "12th Main, Indiranagar, Bangalore",
                "contact_number": "+918012345678",
            },
            {
                "name": "Manipal Diagnostics Centre",
                "location": "ITPL Main Road, Whitefield, Bangalore",
                "contact_number": "+918098765432",
            },
            {
                "name": "Aster Medcity Diagnostic Lab",
                "location": "80 Feet Road, Koramangala, Bangalore",
                "contact_number": "+918023456789",
            },
            {
                "name": "Apollo Diagnostics Centre",
                "location": "4th Block, Jayanagar, Bangalore",
                "contact_number": "+918034567890",
            },
            # Mumbai (3 centres)
            {
                "name": "CarePlus Pathology & Wellness Centre",
                "location": "Linking Road, Bandra West, Mumbai",
                "contact_number": "+912212345678",
            },
            {
                "name": "Suburban Diagnostics Hub",
                "location": "SV Road, Andheri West, Mumbai",
                "contact_number": "+912287654321",
            },
            {
                "name": "SRL Diagnostics Flagship",
                "location": "Central Avenue, Powai, Mumbai",
                "contact_number": "+912234567891",
            },
            # New Delhi (3 centres)
            {
                "name": "Metropolis Diagnostics Capital",
                "location": "Barakhamba Road, Connaught Place, New Delhi",
                "contact_number": "+911112345678",
            },
            {
                "name": "Max Healthcare Diagnostics",
                "location": "Ring Road, South Extension, New Delhi",
                "contact_number": "+911198765432",
            },
            {
                "name": "Dr. Lal PathLabs Excellence",
                "location": "Aurobindo Marg, Hauz Khas, New Delhi",
                "contact_number": "+911145678901",
            },
            # Hyderabad (2 centres)
            {
                "name": "Vijaya Diagnostic Hub",
                "location": "Road No. 1, Banjara Hills, Hyderabad",
                "contact_number": "+914012345678",
            },
            {
                "name": "Lucid Medical Diagnostics",
                "location": "Cyber Towers Road, Hitec City, Hyderabad",
                "contact_number": "+914098765432",
            },
            # Chennai (2 centres)
            {
                "name": "Anderson Diagnostics & Labs",
                "location": "College Road, Nungambakkam, Chennai",
                "contact_number": "+914412345678",
            },
            {
                "name": "Neuberg Ehrlich Clinical Laboratory",
                "location": "Panagal Park, T. Nagar, Chennai",
                "contact_number": "+914498765432",
            },
            # Pune (2 centres)
            {
                "name": "Ruby Hall Diagnostic Clinic",
                "location": "Dhole Patil Road, Koregaon Park, Pune",
                "contact_number": "+912012345678",
            },
            {
                "name": "Aundh Advanced Pathology Centre",
                "location": "DP Road, Aundh, Pune",
                "contact_number": "+912098765432",
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

        # ---------------------------------------------------------
        # 5. Link Tests to Centres (CentreTest) — 130+ Price Links
        # ---------------------------------------------------------
        print("\n[*] Linking Tests to Centres (130+ Centre-Test Pairings)...")
        # Base pricing catalog
        test_base_prices = {
            "Complete Blood Count (CBC)": Decimal("450.00"),
            "Lipid Profile": Decimal("850.00"),
            "Thyroid Stimulating Hormone (TSH)": Decimal("550.00"),
            "HbA1c (Glycated Hemoglobin)": Decimal("650.00"),
            "Vitamin D3 & B12 Combo": Decimal("1400.00"),
            "Liver Function Test (LFT)": Decimal("750.00"),
            "Kidney Function Test (KFT)": Decimal("780.00"),
            "Full Body Comprehensive Health Package": Decimal("2400.00"),
            "Fasting Blood Sugar (FBS)": Decimal("180.00"),
            "Urine Routine & Microscopy": Decimal("250.00"),
            "Cardiac Risk Markers Panel": Decimal("1650.00"),
            "Serum Ferritin & Iron Panel": Decimal("950.00"),
            "Serum Electrolytes (Na, K, Cl)": Decimal("480.00"),
            "Dengue NS1 Antigen & Antibody Panel": Decimal("850.00"),
            "COVID-19 RT-PCR Test": Decimal("500.00"),
            "C-Reactive Protein (CRP) Quantitative": Decimal("450.00"),
            "Allergy Screening Panel (30 Allergens)": Decimal("2800.00"),
            "Prostate Specific Antigen (PSA) Total": Decimal("800.00"),
            "Serum Calcium & Phosphorus": Decimal("380.00"),
            "Beta HCG Quantitative": Decimal("700.00"),
        }

        # Each centre offers a selection of 8 to 14 tests with slight price variations
        centre_offerings = [
            ("Apex Diagnostic & Imaging Hub", [
                "Complete Blood Count (CBC)", "Lipid Profile", "Thyroid Stimulating Hormone (TSH)",
                "HbA1c (Glycated Hemoglobin)", "Vitamin D3 & B12 Combo", "Liver Function Test (LFT)",
                "Kidney Function Test (KFT)", "Full Body Comprehensive Health Package", "Fasting Blood Sugar (FBS)"
            ], Decimal("1.00")),
            ("Manipal Diagnostics Centre", [
                "Complete Blood Count (CBC)", "Kidney Function Test (KFT)", "Liver Function Test (LFT)",
                "Vitamin D3 & B12 Combo", "Cardiac Risk Markers Panel", "Serum Ferritin & Iron Panel",
                "Full Body Comprehensive Health Package", "COVID-19 RT-PCR Test", "Serum Electrolytes (Na, K, Cl)"
            ], Decimal("1.05")),
            ("Aster Medcity Diagnostic Lab", [
                "Complete Blood Count (CBC)", "Lipid Profile", "Thyroid Stimulating Hormone (TSH)",
                "HbA1c (Glycated Hemoglobin)", "Urine Routine & Microscopy", "Serum Electrolytes (Na, K, Cl)",
                "Dengue NS1 Antigen & Antibody Panel", "Prostate Specific Antigen (PSA) Total"
            ], Decimal("0.98")),
            ("Apollo Diagnostics Centre", [
                "Complete Blood Count (CBC)", "Lipid Profile", "Liver Function Test (LFT)", "Kidney Function Test (KFT)",
                "Vitamin D3 & B12 Combo", "Full Body Comprehensive Health Package", "Allergy Screening Panel (30 Allergens)",
                "C-Reactive Protein (CRP) Quantitative", "Thyroid Stimulating Hormone (TSH)"
            ], Decimal("1.08")),
            ("CarePlus Pathology & Wellness Centre", [
                "Complete Blood Count (CBC)", "Lipid Profile", "Vitamin D3 & B12 Combo", "Liver Function Test (LFT)",
                "Full Body Comprehensive Health Package", "Fasting Blood Sugar (FBS)", "Thyroid Stimulating Hormone (TSH)",
                "Serum Calcium & Phosphorus", "Beta HCG Quantitative"
            ], Decimal("1.02")),
            ("Suburban Diagnostics Hub", [
                "Complete Blood Count (CBC)", "Thyroid Stimulating Hormone (TSH)", "Kidney Function Test (KFT)",
                "HbA1c (Glycated Hemoglobin)", "Dengue NS1 Antigen & Antibody Panel", "Cardiac Risk Markers Panel",
                "Urine Routine & Microscopy", "Serum Ferritin & Iron Panel"
            ], Decimal("1.00")),
            ("SRL Diagnostics Flagship", [
                "Complete Blood Count (CBC)", "Lipid Profile", "Kidney Function Test (KFT)", "Liver Function Test (LFT)",
                "Full Body Comprehensive Health Package", "Allergy Screening Panel (30 Allergens)", "COVID-19 RT-PCR Test",
                "Vitamin D3 & B12 Combo", "Prostate Specific Antigen (PSA) Total"
            ], Decimal("1.06")),
            ("Metropolis Diagnostics Capital", [
                "Complete Blood Count (CBC)", "Thyroid Stimulating Hormone (TSH)", "HbA1c (Glycated Hemoglobin)",
                "Liver Function Test (LFT)", "Full Body Comprehensive Health Package", "Cardiac Risk Markers Panel",
                "Serum Ferritin & Iron Panel", "C-Reactive Protein (CRP) Quantitative"
            ], Decimal("1.04")),
            ("Max Healthcare Diagnostics", [
                "Complete Blood Count (CBC)", "Kidney Function Test (KFT)", "Vitamin D3 & B12 Combo",
                "Lipid Profile", "Full Body Comprehensive Health Package", "Allergy Screening Panel (30 Allergens)",
                "Beta HCG Quantitative", "Serum Electrolytes (Na, K, Cl)"
            ], Decimal("1.10")),
            ("Dr. Lal PathLabs Excellence", [
                "Complete Blood Count (CBC)", "HbA1c (Glycated Hemoglobin)", "Thyroid Stimulating Hormone (TSH)",
                "Fasting Blood Sugar (FBS)", "Urine Routine & Microscopy", "Liver Function Test (LFT)",
                "Kidney Function Test (KFT)", "Dengue NS1 Antigen & Antibody Panel"
            ], Decimal("0.95")),
            ("Vijaya Diagnostic Hub", [
                "Complete Blood Count (CBC)", "Lipid Profile", "Thyroid Stimulating Hormone (TSH)",
                "HbA1c (Glycated Hemoglobin)", "Vitamin D3 & B12 Combo", "Cardiac Risk Markers Panel",
                "Full Body Comprehensive Health Package", "Serum Calcium & Phosphorus"
            ], Decimal("0.97")),
            ("Lucid Medical Diagnostics", [
                "Complete Blood Count (CBC)", "Kidney Function Test (KFT)", "Liver Function Test (LFT)",
                "COVID-19 RT-PCR Test", "Serum Electrolytes (Na, K, Cl)", "C-Reactive Protein (CRP) Quantitative",
                "Serum Ferritin & Iron Panel", "Prostate Specific Antigen (PSA) Total"
            ], Decimal("1.00")),
            ("Anderson Diagnostics & Labs", [
                "Complete Blood Count (CBC)", "Lipid Profile", "Thyroid Stimulating Hormone (TSH)",
                "Liver Function Test (LFT)", "Full Body Comprehensive Health Package", "Allergy Screening Panel (30 Allergens)",
                "Beta HCG Quantitative", "Fasting Blood Sugar (FBS)"
            ], Decimal("1.02")),
            ("Neuberg Ehrlich Clinical Laboratory", [
                "Complete Blood Count (CBC)", "Kidney Function Test (KFT)", "HbA1c (Glycated Hemoglobin)",
                "Vitamin D3 & B12 Combo", "Cardiac Risk Markers Panel", "Dengue NS1 Antigen & Antibody Panel",
                "Urine Routine & Microscopy", "Serum Calcium & Phosphorus"
            ], Decimal("1.00")),
            ("Ruby Hall Diagnostic Clinic", [
                "Complete Blood Count (CBC)", "Lipid Profile", "Liver Function Test (LFT)", "Kidney Function Test (KFT)",
                "Thyroid Stimulating Hormone (TSH)", "Full Body Comprehensive Health Package", "Serum Ferritin & Iron Panel",
                "C-Reactive Protein (CRP) Quantitative"
            ], Decimal("1.03")),
            ("Aundh Advanced Pathology Centre", [
                "Complete Blood Count (CBC)", "Fasting Blood Sugar (FBS)", "HbA1c (Glycated Hemoglobin)",
                "Urine Routine & Microscopy", "Vitamin D3 & B12 Combo", "Serum Electrolytes (Na, K, Cl)",
                "COVID-19 RT-PCR Test", "Prostate Specific Antigen (PSA) Total"
            ], Decimal("0.96")),
        ]

        link_count = 0
        seeded_centre_tests = {}
        for centre_name, test_list, multiplier in centre_offerings:
            c = created_centres[centre_name]
            for t_name in test_list:
                t = created_tests[t_name]
                base_p = test_base_prices[t_name]
                adj_price = (base_p * multiplier).quantize(Decimal("1.00"))

                stmt = select(CentreTest).where(
                    CentreTest.centre_id == c.id,
                    CentreTest.test_id == t.id,
                )
                existing_link = (await session.execute(stmt)).scalar_one_or_none()
                if not existing_link:
                    ct = CentreTest(
                        centre_id=c.id,
                        test_id=t.id,
                        price=adj_price,
                        is_available=True,
                    )
                    session.add(ct)
                    await session.flush()
                    seeded_centre_tests[(centre_name, t_name)] = ct
                else:
                    seeded_centre_tests[(centre_name, t_name)] = existing_link
                link_count += 1

        print(f"    [+] Verified and linked {link_count} Centre-Test offerings!")

        await session.commit()

        # Summary Count
        tests_count = len(created_tests)
        centres_count = len(created_centres)
        users_count = len(seeded_users)

        print("\n" + "=" * 75)
        print("  SEEDING COMPLETE SUMMARY:")
        print(f"  • Users Registered:           {users_count} (1 Admin + 3 Patients)")
        print(f"  • Diagnostic Tests:           {tests_count}")
        print(f"  • Diagnostic Centres:         {centres_count}")
        print(f"  • Centre-Test Price Links:    {link_count}")
        print(f"  • Sample Bookings:            0 (Clean slate for user testing)")
        print(f"  • TOTAL SEEDED ENTITIES:      {users_count + tests_count + centres_count + link_count}+ records!")
        print("=" * 75)


if __name__ == "__main__":
    asyncio.run(seed_database())

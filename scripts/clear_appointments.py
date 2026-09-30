"""
Clear all bookings, payments, and webhook events from database.
Leaves users, centres, tests, and centre_test price links completely intact.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import delete
from app.db.session import AsyncSessionLocal
from app.models.booking import Booking
from app.models.payment import Payment
from app.models.webhook_event import WebhookEvent

async def clear_all_appointments():
    print("[*] Clearing all appointments and payments from database...")
    async with AsyncSessionLocal() as session:
        # Delete payments first (foreign key to bookings)
        await session.execute(delete(Payment))
        # Delete webhook events
        await session.execute(delete(WebhookEvent))
        # Delete bookings
        await session.execute(delete(Booking))
        await session.commit()
    print("[✓] All bookings and payments successfully cleared! Database has 0 appointments.")

if __name__ == "__main__":
    asyncio.run(clear_all_appointments())

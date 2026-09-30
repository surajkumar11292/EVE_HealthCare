import json
import uuid
import pytest
from unittest.mock import AsyncMock, patch

from app.services.payment_service import payment_service
from app.tasks.webhook_tasks import (
    process_webhook_event_task,
    send_booking_confirmation_email_task,
)


def test_send_booking_confirmation_email_task():
    """
    Verifies that the simulated background email task executes and returns expected delivery confirmation.
    """
    booking_id = str(uuid.uuid4())
    email = "patient.jane@example.com"

    result = send_booking_confirmation_email_task.apply(args=[booking_id, email]).get()

    assert result["status"] == "delivered"
    assert result["booking_id"] == booking_id
    assert result["recipient_email"] == email
    assert "sent_at" in result


def test_process_webhook_event_task_mocked():
    """
    Verifies that process_webhook_event_task correctly delegates to the async webhook processor.
    """
    event_id = f"evt_celery_{uuid.uuid4().hex[:12]}"
    booking_id = str(uuid.uuid4())
    payload_dict = {
        "event_id": event_id,
        "event_type": "payment.success",
        "transaction_id": "TXN-CELERY-1",
        "booking_id": booking_id,
        "status": "SUCCESS",
    }
    raw_body_str = json.dumps(payload_dict)
    sig = payment_service.generate_signature(raw_body_str.encode("utf-8"))

    mock_response = {
        "status": "processed",
        "message": "Webhook processed successfully via Celery worker.",
        "event_id": event_id,
    }

    with patch(
        "app.tasks.webhook_tasks._async_process_webhook_internal",
        new=AsyncMock(return_value=mock_response),
    ):
        result = process_webhook_event_task.apply(
            args=[raw_body_str, payload_dict, sig]
        ).get()

        assert result["status"] == "processed"
        assert result["event_id"] == event_id

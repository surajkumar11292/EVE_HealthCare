  # EVE Healthcare — Diagnostic Test Booking & Payment Backend

A high-performance, production-grade backend service for diagnostic test bookings, price snapshotting, and idempotent simulated payment processing. Built with **FastAPI**, **PostgreSQL 16**, **Redis 7**, **Celery**, and **Docker**.

---

## Architecture Overview

```
Client (Web / Mobile / cURL)
             │
             ▼
 ┌─────────────────────────────────────────────────────────────────┐
 │  FastAPI Application (Uvicorn ASGI Engine)                      │
 │  ┌───────────────────────────────────────────────────────────┐  │
 │  │  Middleware Pipeline                                      │  │
 │  │  - CORS (allow credentials & origins)                     │  │
 │  │  - Request Correlation ID Injection (X-Request-ID)        │  │
 │  │  - Structured JSON Logging (structlog)                    │  │
 │  │  - Distributed Rate Limiter (SlowAPI backed by Redis)     │  │
 │  └─────────────────────────────┬─────────────────────────────┘  │
 │                                │                                │
 │  ┌─────────────────────────────┴─────────────────────────────┐  │
 │  │  API Version 1 Routers (/api/v1)                          │  │
 │  │  - /auth       (Signup, Login, Profile)                   │  │
 │  │  - /centres    (Catalogue, Locations, Pricing)            │  │
 │  │  - /tests      (Diagnostic Test Definitions)              │  │
 │  │  - /bookings   (State-Machine Booking Engine)             │  │
 │  │  - /payments   (Mock Gateway & Idempotent Webhook)        │  │
 │  └─────────────────────────────┬─────────────────────────────┘  │
 └────────────────────────────────┼────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  PostgreSQL 16   │    │     Redis 7      │    │  Celery Worker   │
│  - Users & Roles │    │  - API Cache     │    │  - Exponential   │
│  - Centres/Tests │    │  - Rate Limits   │    │    Backoff Retry │
│  - Bookings      │    │  - Celery Broker │    │  - Notifications │
│  - Payments      │    │  - Result State  │    │                  │
│  - Webhook Ledger│    │                  │    │                  │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

### Technology Stack

| Layer | Component | Version / Specification |
|---|---|---|
| **Framework** | FastAPI | 0.111+ (Fully Asynchronous) |
| **ASGI Server** | Uvicorn | 0.30+ |
| **Database** | PostgreSQL | 16 with async SQLAlchemy 2.0 & Alembic |
| **DB Driver** | asyncpg | High-throughput asynchronous PostgreSQL driver |
| **Cache & Broker** | Redis | 7 Alpine |
| **Background Jobs** | Celery | 5.4+ with Redis broker and result backend |
| **Authentication** | JWT + Bcrypt | python-jose & passlib with safe 72-byte truncation |
| **Validation** | Pydantic v2 | Strict request/response validation & serialization |
| **Rate Limiting** | SlowAPI | Distributed rate limiting with automatic in-memory fallback |
| **Logging** | structlog | Structured JSON event logging with request tracing |
| **Testing** | pytest | pytest-asyncio, httpx, coverage |
| **Containerisation**| Docker & Compose | Multi-container orchestration |

---

## Database Design & Entity Relationship

```
 ┌───────────────┐                  ┌────────────────────────┐
 │     USERS     │                  │        BOOKINGS        │
 ├───────────────┤                  ├────────────────────────┤
 │ id (UUID, PK) │1                *│ id (UUID, PK)          │
 │ email (UQ)    ├──────────────────┤ user_id (UUID, FK)     │
 │ full_name     │                  │ centre_test_id (UUID)  │
 │ hashed_pass   │                  │ appointment_time (TZ)  │
 │ role (ENUM)   │                  │ amount (NUMERIC, LOCK) │
 │ is_active     │                  │ status (ENUM)          │
 └───────────────┘                  │ notes                  │
                                    └───────────┬────────────┘
 ┌───────────────┐                              │
 │    CENTRES    │                              │ 1
 ├───────────────┤ 1                            │
 │ id (UUID, PK) ├───────────┐                  │
 │ name          │           │                  │ 1
 │ location      │           │          ┌───────┴────────────────┐
 │ contact_no    │           │          │        PAYMENTS        │
 └───────────────┘           │          ├────────────────────────┤
                             ▼ *        │ id (UUID, PK)          │
                    ┌─────────────────┐ │ booking_id (UUID, UQ)  │
                    │  CENTRE_TESTS   │ │ transaction_id (UQ)    │
                    ├─────────────────┤ │ idempotency_key (UQ)   │
                    │ id (UUID, PK)   │ │ amount (NUMERIC)       │
                    │ centre_id (FK)  │ │ status (ENUM)          │
                    │ test_id (FK)    │ │ failure_reason         │
                    │ price (NUMERIC) │ └────────────────────────┘
                    │ is_available    │
                    └────────┬────────┘ ┌────────────────────────┐
                             ▲ *        │     WEBHOOK_EVENTS     │
 ┌───────────────┐           │          ├────────────────────────┤
 │     TESTS     │           │          │ id (UUID, PK)          │
 ├───────────────┤ 1         │          │ event_id (VARCHAR, UQ) │
 │ id (UUID, PK) ├───────────┘          │ event_type             │
 │ name (UQ)     │                      │ payload (JSONB)        │
 │ description   │                      │ status (ENUM)          │
 │ category      │                      │ processed_at           │
 └───────────────┘                      └────────────────────────┘
```

### Key Architectural Decisions

1. **Price Snapshotting**: The test price is copied from `centre_tests.price` directly into `bookings.amount` at booking creation time. Diagnostic centres may adjust their pricing later, but the historical booking amount remains immutable for financial integrity and auditing.
2. **Double-Spend Protection**: The `idempotency_key` on payments ensures that client network retries or double-clicks return the existing payment without charging twice or creating duplicate transactions.
3. **Webhook Concurrency Ledger**: Incoming webhook events enforce row-level locking (`SELECT FOR UPDATE`) on the unique `event_id` in `webhook_events`. Concurrent duplicate webhook deliveries immediately return HTTP 200 with status `"already_processed"`, protecting booking states from race conditions.
4. **Timing Attack Mitigation**: Webhook HMAC-SHA256 signatures are validated using constant-time comparison (`hmac.compare_digest`).

---

## Getting Started

### Option 1: Running with Docker Compose (Recommended)

1. **Clone and start all services**:
   ```bash
   docker compose up --build
   ```
   This automatically brings up:
   - `web`: FastAPI application on port `8000`
   - `db`: PostgreSQL 16 on port `5432`
   - `redis`: Redis 7 on port `6379`
   - `celery_worker`: Background Celery task processor

2. **Verify application health**:
   - Interactive Swagger Docs: http://localhost:8000/docs
   - System Health Check: http://localhost:8000/api/v1/health

---

### Option 2: Running Locally

1. **Prerequisites**:
   - Python 3.11+
   - PostgreSQL 16
   - Redis 7

2. **Setup virtual environment**:
   ```bash
   python -m venv venv
   # On Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # On Linux/macOS:
   source venv/bin/activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

5. **Apply database migrations & seed initial data**:
   ```bash
   alembic upgrade head
   python -m app.db.seed
   ```

6. **Start the API server**:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

7. **Start Celery worker** (in a separate terminal):
   ```bash
   celery -A app.tasks.celery_app.celery_app worker --loglevel=info
   ```

---

## Pre-seeded Credentials

Running `python -m app.db.seed` automatically sets up the following accounts:

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Admin** | `admin@evehealthcare.com` | `Admin@12345` | Full catalogue control, centre creation, global booking inspection |
| **Patient** | `patient@evehealthcare.com` | `Patient@12345` | Book tests, simulate payments, cancel own bookings |

Pre-seeded catalogue includes:
- **3 Diagnostic Centres**: Apollo Diagnostics (Mumbai), Dr. Lal PathLabs (Delhi), SRL Diagnostics (Bengaluru).
- **6 Diagnostic Tests**: Complete Blood Count, Lipid Profile, Fasting Blood Glucose, Thyroid Panel, MRI Brain, Digital Chest X-Ray.

---

## API Endpoints Reference

| Category | Method | Endpoint | Auth | Description |
|---|---|---|---|---|
| **System** | `GET` | `/api/v1/health` | Public | System status and environment |
| **Auth** | `POST` | `/api/v1/auth/signup` | Public | Register new patient or admin |
| **Auth** | `POST` | `/api/v1/auth/login` | Public | Authenticate and obtain JWT token |
| **Auth** | `GET` | `/api/v1/auth/me` | Bearer JWT | Retrieve authenticated profile |
| **Centres** | `GET` | `/api/v1/centres/` | Public | List centres (cached, paginated, filtered) |
| **Centres** | `POST` | `/api/v1/centres/` | Admin JWT | Create diagnostic centre |
| **Centres** | `GET` | `/api/v1/centres/{id}` | Public | Centre details with tests & prices |
| **Centres** | `PATCH` | `/api/v1/centres/{id}` | Admin JWT | Update centre details |
| **Centres** | `DELETE`| `/api/v1/centres/{id}` | Admin JWT | Soft delete centre |
| **Centres** | `POST` | `/api/v1/centres/{id}/tests` | Admin JWT | Link test to centre with price |
| **Tests** | `GET` | `/api/v1/tests/` | Public | List all diagnostic tests |
| **Tests** | `POST` | `/api/v1/tests/` | Admin JWT | Create diagnostic test |
| **Bookings**| `POST` | `/api/v1/bookings/` | Patient JWT | Create booking (snapshots price) |
| **Bookings**| `GET` | `/api/v1/bookings/` | Bearer JWT | List bookings (isolated for patients) |
| **Bookings**| `GET` | `/api/v1/bookings/{id}` | Bearer JWT | Get booking by ID |
| **Bookings**| `POST` | `/api/v1/bookings/{id}/cancel` | Bearer JWT | Cancel booking |
| **Payments**| `POST` | `/api/v1/payments/` | Patient JWT | Process simulated payment (idempotent) |
| **Payments**| `POST` | `/api/v1/payments/webhook/` | HMAC Header | Payment status webhook (idempotent) |
| **Payments**| `GET` | `/api/v1/payments/{id}` | Bearer JWT | Get payment details |

---

## Step-by-Step Workflow & cURL Examples

### 1. User Signup
```bash
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane.doe@example.com",
    "full_name": "Jane Doe",
    "password": "Password123!",
    "role": "PATIENT"
  }'
```

### 2. User Login (Obtain Token)
```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane.doe@example.com",
    "password": "Password123!"
  }'
```
*Save the returned `access_token` for subsequent requests:*
```bash
TOKEN="<your_access_token_here>"
```

### 3. Check Current User Profile
```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### 4. Browse Diagnostic Centres
```bash
curl -X GET "http://localhost:8000/api/v1/centres/?location=Mumbai"
```

### 5. View Centre Details with Available Tests and Prices
```bash
curl -X GET "http://localhost:8000/api/v1/centres/<CENTRE_ID>"
```
*Locate the `centre_test_id` for your chosen test from the response.*

### 6. Book a Diagnostic Test
```bash
curl -X POST http://localhost:8000/api/v1/bookings/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "centre_test_id": "<CENTRE_TEST_ID>",
    "appointment_time": "2026-10-15T09:30:00Z",
    "notes": "Fasting 12 hours prior"
  }'
```
*Note the returned `booking_id` with initial status `PENDING`.*

### 7. Process Simulated Payment (Client Idempotent)
```bash
curl -X POST http://localhost:8000/api/v1/payments/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": "<BOOKING_ID>",
    "idempotency_key": "client_payment_key_987654321",
    "force_status": "SUCCESS"
  }'
```
*Notice that repeating the above command with the same `idempotency_key` returns the existing payment record without creating duplicate charges.*

### 8. Deliver Payment Provider Webhook
Webhooks accept an HMAC-SHA256 signature generated using `WEBHOOK_SECRET`:
```bash
# In Python or Bash, generate HMAC:
# echo -n '<BODY>' | openssl dgst -sha256 -hmac "super_secret_webhook_signature_key"

curl -X POST http://localhost:8000/api/v1/payments/webhook/ \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: <HMAC_SHA256_HEX>" \
  -d '{
    "event_id": "evt_gateway_982734",
    "event_type": "payment.success",
    "transaction_id": "TXN-0A1B2C3D4E5F",
    "booking_id": "<BOOKING_ID>",
    "status": "SUCCESS"
  }'
```
*Sending the same payload again returns `{"status": "already_processed"}`, preventing duplicate processing.*

### 9. Cancel a Booking
```bash
curl -X POST http://localhost:8000/api/v1/bookings/<BOOKING_ID>/cancel \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Change of travel plans"
  }'
```

---

## Running the Automated Test Suite

The project includes 39 unit and integration tests covering authentication, RBAC authorization, booking state machine transitions, client idempotency, and concurrent webhook race conditions.

Execute tests with coverage:
```bash
pytest -v --cov=app tests/
```

Test Results Breakdown:
- `tests/test_auth.py` (9 tests): Registration, duplicate prevention, password validation, JWT authentication.
- `tests/test_centres.py` (7 tests): Catalogue listing, location filtering, RBAC admin guards, soft deletion.
- `tests/test_bookings.py` (7 tests): Price snapshotting, past date validation, tenant isolation, cancellation transitions.
- `tests/test_payments.py` (8 tests): Payment simulation, client idempotency keys, duplicate charge prevention, access control.
- `tests/test_rate_limit.py` (2 tests): IP resolution, HTTP 429 Too Many Requests triggers.
- `tests/test_webhooks.py` (6 tests): HMAC signatures, duplicate events, concurrent delivery race condition handling.

---

## Assumptions Made

1. **One Active Payment Per Booking**: A diagnostic test booking has a single associated payment lifecycle. If a payment succeeds, the booking transitions to `CONFIRMED`.
2. **Price Snapshotting**: Prices are defined at the centre-test association level (`CentreTest`) rather than globally, accommodating regional and equipment pricing variances. Bookings capture the exact price at creation time.
3. **Webhook Signature Specification**: Simulated payment providers are assumed to send an HMAC-SHA256 signature in the `X-Webhook-Signature` header (or optionally embedded in the request body) keyed on `WEBHOOK_SECRET`.
4. **Timezone Handling**: All appointment dates and event timestamps are strictly stored in UTC (`TIMESTAMPTZ`) to eliminate daylight savings and cross-regional ambiguity.

---

## Future Improvements & Scalability Roadmap

1. **Redis Streams for Webhook Events**: Ingest incoming high-throughput webhook bursts into a durable Redis Stream before dispatching to Celery workers for guaranteed at-least-once delivery.
2. **WebSocket Notifications**: Provide real-time client push updates on booking confirmation status as webhooks arrive.
3. **SMS & WhatsApp Integration**: Dispatch automated reminders 24 hours prior to appointment times using Twilio or Gupshup through Celery Beat.
4. **Full RBAC Permissions Matrix**: Expand the two-tier (`PATIENT`, `ADMIN`) model to granular role matrices (e.g. `PHLEBOTOMIST`, `CENTRE_OPERATOR`, `BILLING_ADMIN`).

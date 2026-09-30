# EVE Healthcare — Diagnostic Booking & Payment Platform

A full-stack web application for booking diagnostic tests, simulating payment processing, and handling payment webhooks. Built with FastAPI (async), PostgreSQL, Redis, Celery, and a React/Vite frontend.

---

## Table of Contents

1. [How to Run Locally with Docker](#1-how-to-run-locally-with-docker)
2. [API Endpoints & Example Requests](#2-api-endpoints--example-requests)
3. [Database Schema Design](#3-database-schema-design)
4. [Architecture & Key Design Decisions](#4-architecture--key-design-decisions)
5. [Running the Test Suite](#5-running-the-test-suite)
6. [Assumptions Made](#6-assumptions-made)
7. [What Would Be Improved with More Time](#7-what-would-be-improved-with-more-time)

---

## 1. How to Run Locally with Docker

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Compose v2)
- Git

### Start all services

```bash
# Clone the repo
git clone <repo-url>
cd EVE_HealthCare

# Start everything (db, redis, api, celery worker, frontend)
docker compose up --build
```

The following services will start:

| Service         | URL                        | Description                        |
|-----------------|----------------------------|------------------------------------|
| API (FastAPI)   | http://localhost:8000      | Backend REST API                   |
| Swagger UI      | http://localhost:8000/docs | Interactive API documentation       |
| ReDoc           | http://localhost:8000/redoc| Alternative API docs               |
| Frontend (Vite) | http://localhost:5173      | React web UI                       |
| PostgreSQL      | localhost:5432             | Database                           |
| Redis           | localhost:6379             | Cache + Celery broker              |

### Seed the database with demo data

After the containers are running:

```bash
docker compose exec web python scripts/seed.py
```

This creates demo users, diagnostic centres, tests, and sample bookings.

**Demo credentials after seeding:**

| Role      | Email                        | Password       |
|-----------|------------------------------|----------------|
| Admin     | admin@evehealthcare.com      | Admin@123456   |
| Patient   | patient@evehealthcare.com    | Patient@123456 |

### Run tests inside Docker

```bash
docker compose exec web pytest tests/ -v --tb=short
```

### Stop all services

```bash
docker compose down
```

To also remove the database volume:

```bash
docker compose down -v
```

---

## 2. API Endpoints & Example Requests

**Base URL:** `http://localhost:8000/api/v1`

All endpoints that modify or read private data require a `Bearer` token in the `Authorization` header. Obtain a token from `POST /auth/login`.

---

### Authentication

#### Register a new user
```http
POST /api/v1/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "full_name": "John Doe",
  "role": "PATIENT"
}
```

#### Login and get a token
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "patient@evehealthcare.com",
  "password": "Patient@123456"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

#### Get current user profile
```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```

---

### Diagnostic Centres & Tests

#### List all diagnostic centres (paginated)
```http
GET /api/v1/centres/?page=1&size=10
GET /api/v1/centres/?location=Mumbai
GET /api/v1/centres/?name=Apex
```

#### Get a centre with its tests and prices (cached in Redis, 5-min TTL)
```http
GET /api/v1/centres/{centre_id}
```

#### Create a centre (Admin only)
```http
POST /api/v1/centres/
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Healthline Diagnostics",
  "location": "MG Road, Pune",
  "contact_number": "+912012345678"
}
```

#### Link a diagnostic test to a centre with pricing (Admin only)
```http
POST /api/v1/centres/{centre_id}/tests
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "test_id": "<test_uuid>",
  "price": "750.00"
}
```

#### List all diagnostic tests
```http
GET /api/v1/tests/?page=1&size=10
GET /api/v1/tests/?category=Hematology
```

---

### Bookings

#### Create a booking (Patient or Admin)
```http
POST /api/v1/bookings/
Authorization: Bearer <patient_token>
Content-Type: application/json

{
  "centre_test_id": "<centre_test_uuid>",
  "appointment_time": "2025-12-01T10:00:00Z",
  "notes": "Fasting required"
}
```

The booking is created in `PENDING` status. The price is snapshotted from the `CentreTest` record at booking time.

**Response:**
```json
{
  "id": "...",
  "status": "PENDING",
  "amount": "450.00",
  "centre_name": "Apex Diagnostic & Imaging Hub",
  "test_name": "Complete Blood Count (CBC)",
  ...
}
```

#### List my bookings (Patient sees own; Admin sees all)
```http
GET /api/v1/bookings/?page=1&size=10
GET /api/v1/bookings/?status=PENDING
Authorization: Bearer <token>
```

#### Get a single booking
```http
GET /api/v1/bookings/{booking_id}
Authorization: Bearer <token>
```

#### Cancel a booking
```http
POST /api/v1/bookings/{booking_id}/cancel
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Schedule conflict"
}
```

Cancellation is only allowed from `PENDING` or `CONFIRMED` state, and only if the appointment time has not yet passed.

---

### Payments

#### Process a simulated payment
```http
POST /api/v1/payments/
Authorization: Bearer <patient_token>
Content-Type: application/json

{
  "booking_id": "<booking_uuid>",
  "idempotency_key": "pay_idem_a1b2c3d4e5f6",
  "force_status": "SUCCESS"
}
```

- `idempotency_key` must be a unique client-generated string (min 8 chars). Repeating the same key returns the original response without creating a new charge.
- `force_status` is optional. When omitted, the system simulates an 80% SUCCESS / 20% FAILED probability.
- On `SUCCESS`, the booking transitions to `CONFIRMED`. On `FAILED`, it transitions to `FAILED`.

#### Get payment by ID
```http
GET /api/v1/payments/{payment_id}
Authorization: Bearer <token>
```

#### Get payment for a specific booking
```http
GET /api/v1/payments/booking/{booking_id}
Authorization: Bearer <token>
```

---

### Payment Webhook

#### Receive a payment status update from the payment provider
```http
POST /payments/webhook/
X-Webhook-Signature: <hmac_sha256_hex>
Content-Type: application/json

{
  "event_id": "evt_sim_1234567890",
  "event_type": "payment.success",
  "transaction_id": "TXN-ABCDEF123456",
  "booking_id": "<booking_uuid>",
  "status": "SUCCESS",
  "failure_reason": null
}
```

The webhook endpoint:
1. Verifies the `X-Webhook-Signature` header (HMAC-SHA256 using `WEBHOOK_SECRET`).
2. Checks the `webhook_events` ledger for the `event_id` to guarantee idempotency.
3. Uses a `SELECT FOR UPDATE` database row lock to safely handle concurrent duplicate deliveries.
4. Returns `200 OK` for all outcomes (including duplicates and unknown booking IDs) to prevent the provider from retrying indefinitely.

**Generating a valid signature (Python example):**
```python
import hmac, hashlib, json

secret = "super_secret_webhook_signature_key"
payload = {"event_id": "evt_1", "event_type": "payment.success", ...}
body_bytes = json.dumps(payload).encode("utf-8")
signature = hmac.new(secret.encode(), body_bytes, hashlib.sha256).hexdigest()
```

---

## 3. Database Schema Design

```
users
  id (UUID, PK)
  email (unique, indexed)
  full_name
  hashed_password
  role (PATIENT | ADMIN)
  phone_number
  is_active
  created_at, updated_at

centres
  id (UUID, PK)
  name
  location
  contact_number
  is_active
  created_at, updated_at

diagnostic_tests
  id (UUID, PK)
  name (unique)
  category
  description
  is_active
  created_at, updated_at

centre_tests                        ← junction table (many-to-many)
  id (UUID, PK)
  centre_id (FK → centres)
  test_id   (FK → diagnostic_tests)
  price     (Decimal 10,2)
  is_available
  UNIQUE(centre_id, test_id)
  created_at, updated_at

bookings
  id (UUID, PK)
  user_id        (FK → users)
  centre_test_id (FK → centre_tests)
  appointment_time (timestamptz)
  amount         (Decimal — price snapshotted at booking time)
  status         (PENDING | CONFIRMED | FAILED | CANCELLED)
  notes
  created_at, updated_at

payments
  id (UUID, PK)
  booking_id       (FK → bookings, unique — one payment per booking)
  transaction_id   (unique)
  idempotency_key  (unique, indexed)
  provider
  amount
  status           (PENDING | SUCCESS | FAILED)
  failure_reason
  created_at, updated_at

webhook_events                      ← idempotency ledger
  id (UUID, PK)
  event_id    (unique, indexed)
  event_type
  payload     (JSONB)
  status      (PROCESSING | PROCESSED | DUPLICATE | FAILED)
  retry_count
  processed_at
  created_at, updated_at
```

**Key relationships:**
- One `Centre` → many `CentreTest` entries → many `Booking` entries
- One `Booking` → at most one `Payment`
- One `WebhookEvent` per `event_id` (enforced by unique constraint)

---

## 4. Architecture & Key Design Decisions

### Booking State Machine

```
[PENDING] ──payment SUCCESS──▶ [CONFIRMED]
[PENDING] ──payment FAILED───▶ [FAILED]
[PENDING] ──cancel───────────▶ [CANCELLED]
[CONFIRMED] ──cancel──────────▶ [CANCELLED]  (only before appointment time)
[FAILED]    ──(terminal, no transitions allowed)
[CANCELLED] ──(terminal, no transitions allowed)
```

### Payment Idempotency

Client-side idempotency key is required on every `POST /payments/` request. The `idempotency_key` column has a database-level `UNIQUE` constraint. If a concurrent insert produces a `UniqueConstraint` error (race condition), the service catches the `IntegrityError`, rolls back, and returns the already-recorded payment — no duplicate charge is possible.

### Webhook Idempotency

The `webhook_events` table acts as a ledger. Before processing any webhook, the system queries for `event_id` using `SELECT FOR UPDATE`. If a record exists, the response is returned immediately without re-processing. The `UNIQUE` constraint on `event_id` provides a secondary safety net for concurrent requests.

### Redis Caching

`GET /centres/{centre_id}` responses (including their test list) are cached in Redis with a 5-minute TTL. Any admin mutation (update centre, link/unlink test, update price) immediately invalidates the relevant cache key to prevent stale reads.

### Rate Limiting

SlowAPI (wraps the Redis backend) enforces per-IP request limits:

| Route group | Limit          |
|-------------|----------------|
| Auth (login, signup) | 10 per minute |
| Payments    | 20 per minute  |
| Webhook     | 100 per minute |
| Everything else | 60 per minute |

A `429 Too Many Requests` response includes a `Retry-After` header.

### Background Jobs (Celery)

A Celery worker (backed by Redis) handles asynchronous webhook retry processing with exponential backoff (max 5 retries, max delay 300 s). A separate task simulates booking confirmation email delivery after a successful payment.

### Structured Logging

All requests produce structured JSON log lines via `structlog`. Every log entry includes `request_id`, `method`, `path`, `status_code`, and `duration_ms`. The `request_id` is echoed back in the `X-Request-ID` response header for tracing.

---

## 5. Running the Test Suite

Tests use an in-memory SQLite database (via `aiosqlite`) so no running PostgreSQL is needed for the unit/integration suite.

```bash
# Inside the web container
docker compose exec web pytest tests/ -v --tb=short

# With coverage report
docker compose exec web pytest tests/ --cov=app --cov-report=term-missing
```

**Test coverage areas:**

| File                  | Coverage                                                                 |
|-----------------------|--------------------------------------------------------------------------|
| `test_auth.py`        | Signup, login, duplicate email, bad credentials, inactive user           |
| `test_centres.py`     | CRUD, pagination, admin-only guards, test linking, price update          |
| `test_bookings.py`    | Create, list, get, cancel, ownership isolation, state-machine validation |
| `test_payments.py`    | Success, failure, idempotency, ownership, state conflict (409)           |
| `test_webhooks.py`    | Signature verification, idempotency, unknown booking, duplicate events   |
| `test_rate_limit.py`  | Rate limit header presence, 429 response structure                       |
| `test_celery_tasks.py`| Task invocation and return structure                                     |

---

## 6. Assumptions Made

1. **One payment per booking.** Once a payment attempt is recorded (SUCCESS or FAILED), no second attempt can be made using a different idempotency key. The booking must be re-created if the patient wants to retry after a failure.

2. **Price snapshotting is intentional.** The amount stored on the `Booking` row is the price at the moment of booking, not the current price in `CentreTest`. This protects the patient from price changes after booking.

3. **Webhook signature is mandatory.** Webhooks without a valid HMAC-SHA256 signature (either in the `X-Webhook-Signature` header or in the `signature` body field) are rejected with `401 Unauthorized`. This is a deliberate security requirement.

4. **Admin can manage any booking or payment.** Role-based access is enforced: Patients can only see/manage their own bookings and payments; Admins have full read/write access.

5. **Appointment time must be in the future** at the time of booking creation. This is validated server-side.

6. **Soft-delete for centres.** Centres are deactivated (`is_active = false`) rather than permanently deleted to preserve historical booking records.

7. **Single `centre_test_id` lookup.** The booking API accepts either a direct `centre_test_id` or the combination of `centre_id + test_id`. The latter resolves to the `CentreTest` junction record automatically.

---

## 7. What Would Be Improved with More Time

1. **Appointment time conflict detection.** Currently the system allows two bookings for the same centre-test slot at the same time. A proper availability calendar with per-slot capacity would prevent double-booking.

2. **Refresh tokens.** The JWT implementation issues only access tokens. Adding refresh tokens would improve security without requiring frequent re-logins.

3. **Full email integration.** The `send_booking_confirmation_email_task` Celery task is simulated (logs only). Connecting to a real email provider (SendGrid, SES) would complete the notification flow.

4. **Alembic migration workflow.** Tables are currently created with `Base.metadata.create_all` on startup. In production, Alembic migrations should be the only mechanism for schema changes, with a migration script run before each deployment.

5. **More granular rate limiting.** Rate limits are currently per-IP. Authenticated endpoints should enforce per-user rate limits to prevent abuse from shared IPs (e.g., corporate NAT).

6. **Role-based signup restrictions.** Currently, any client can self-register as an `ADMIN`. In production, admin accounts should only be created by existing admins or provisioned via a separate secure channel.

7. **Observability.** Adding OpenTelemetry tracing (Jaeger/Tempo) and exporting metrics to Prometheus would allow production-grade monitoring and alerting.

8. **Pagination cursor.** The current offset-based pagination can become slow on large tables. Cursor-based pagination would be more performant at scale.

---

## Environment Variables

All defaults are set in `docker-compose.yml`. For local non-Docker development, copy `.env.example` to `.env` and adjust values.

| Variable                      | Default (Docker)                                        | Description                           |
|-------------------------------|--------------------------------------------------------|---------------------------------------|
| `SECRET_KEY`                  | `super_secret_development_jwt_key_...`                 | JWT signing key (change in production)|
| `DATABASE_URL`                | `postgresql+asyncpg://postgres:...@db:5432/eve_healthcare` | Async DB connection string        |
| `REDIS_URL`                   | `redis://redis:6379/0`                                 | Redis for cache and rate limiting     |
| `WEBHOOK_SECRET`              | `super_secret_webhook_signature_key`                   | HMAC key for webhook signature verify |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60`                                                   | JWT token lifetime                    |
| `RATE_LIMIT_AUTH`             | `10/minute`                                            | Auth endpoint rate limit              |
| `RATE_LIMIT_PAYMENT`          | `20/minute`                                            | Payment endpoint rate limit           |

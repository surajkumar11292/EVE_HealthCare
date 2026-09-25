# EVE Healthcare — Backend Service

A backend service for diagnostic test bookings and simulated payments, built using **FastAPI**, **PostgreSQL**, **Redis**, and **Celery**.

---

## Architecture Overview

- **Framework**: FastAPI (fully asynchronous)
- **Database**: PostgreSQL 16 with async SQLAlchemy 2.0 & Alembic
- **Cache & Message Broker**: Redis 7
- **Background Worker**: Celery
- **Logging**: Structured JSON logging via `structlog`
- **Containerization**: Docker & Docker Compose

---

## Project Structure

```
eve_healthcare/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── router.py         # API V1 router hub
│   ├── core/
│   │   ├── config.py             # Pydantic Settings
│   │   └── logging.py            # Structured logging setup
│   ├── tasks/
│   │   └── celery_app.py         # Celery instance configuration
│   └── main.py                   # FastAPI application factory & middleware
├── .env.example                  # Environment variable template
├── .gitignore                    # Git ignore file
├── docker-compose.yml            # Multi-service composition
├── Dockerfile                    # Container image specification
└── requirements.txt              # Production and development dependencies
```

---

## Getting Started

### Option 1: Running with Docker Compose (Recommended)

1. Build and launch all services (`web`, `db`, `redis`, `celery_worker`):
   ```bash
   docker compose up --build
   ```

2. Verify that the services are healthy:
   - FastAPI application: http://localhost:8000
   - Interactive Swagger API docs: http://localhost:8000/docs
   - System Health Check: http://localhost:8000/api/v1/health

---

### Option 2: Running Locally

1. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # On Linux/macOS:
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

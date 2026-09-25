from typing import Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.test import DiagnosticTest
from app.models.user import User
from app.schemas.test import (
    TestCreateRequest,
    TestResponse,
    TestUpdateRequest,
)
from app.services.centre_service import centre_service

router = APIRouter(prefix="/tests", tags=["Diagnostic Tests"])


@router.get(
    "/",
    response_model=Page[TestResponse],
    summary="List diagnostic tests",
    description="Returns a paginated catalog of diagnostic tests with optional category or name filtering.",
)
async def list_tests(
    name: Optional[str] = Query(None, description="Filter by test name substring"),
    category: Optional[str] = Query(None, description="Filter by category"),
    is_active: Optional[bool] = Query(True, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
):
    query = select(DiagnosticTest).order_by(DiagnosticTest.name.asc())

    if name:
        query = query.where(DiagnosticTest.name.ilike(f"%{name}%"))
    if category:
        query = query.where(DiagnosticTest.category.ilike(f"%{category}%"))
    if is_active is not None:
        query = query.where(DiagnosticTest.is_active == is_active)

    return await apaginate(db, query)


@router.post(
    "/",
    response_model=TestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new diagnostic test (Admin only)",
    description="Adds a new diagnostic test to the medical catalog. Invalidates Redis cache. Requires Admin role.",
)
async def create_test(
    payload: TestCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> TestResponse:
    test = await centre_service.create_test(db, payload)
    return test


@router.get(
    "/{test_id}",
    response_model=TestResponse,
    summary="Get diagnostic test details (Cached via Redis)",
    description="Retrieves a diagnostic test by its unique ID. Cached in Redis with 5 min TTL.",
)
async def get_test(
    test_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> TestResponse:
    return await centre_service.get_test_cached(db, test_id)


@router.patch(
    "/{test_id}",
    response_model=TestResponse,
    summary="Update a diagnostic test (Admin only)",
    description="Updates test description, category, or active status. Invalidates Redis cache. Requires Admin role.",
)
async def update_test(
    test_id: uuid.UUID,
    payload: TestUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> TestResponse:
    test = await centre_service.update_test(db, test_id, payload)
    return test


@router.delete(
    "/{test_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deactivate a diagnostic test (Admin only)",
    description="Soft-deactivates a diagnostic test. Invalidates Redis cache. Requires Admin role.",
)
async def delete_test(
    test_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    await centre_service.delete_test(db, test_id)
    return None

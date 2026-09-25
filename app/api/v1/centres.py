from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from fastapi_pagination import Page
from fastapi_pagination.ext.sqlalchemy import apaginate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import require_admin
from app.db.session import get_db
from app.models.centre import Centre
from app.models.centre_test import CentreTest
from app.models.user import User
from app.schemas.centre import (
    CentreCreateRequest,
    CentreDetailResponse,
    CentreResponse,
    CentreTestLinkRequest,
    CentreTestResponse,
    CentreTestUpdatePriceRequest,
    CentreUpdateRequest,
)
from app.services.centre_service import centre_service

router = APIRouter(prefix="/centres", tags=["Diagnostic Centres"])


@router.get(
    "/",
    response_model=Page[CentreResponse],
    summary="List diagnostic centres",
    description="Returns a paginated list of diagnostic centres with optional filtering by location or name.",
)
async def list_centres(
    name: Optional[str] = Query(None, description="Filter by centre name substring"),
    location: Optional[str] = Query(None, description="Filter by location substring"),
    is_active: Optional[bool] = Query(True, description="Filter by active status"),
    db: AsyncSession = Depends(get_db),
):
    query = select(Centre).order_by(Centre.name.asc())

    if name:
        query = query.where(Centre.name.ilike(f"%{name}%"))
    if location:
        query = query.where(Centre.location.ilike(f"%{location}%"))
    if is_active is not None:
        query = query.where(Centre.is_active == is_active)

    return await apaginate(db, query)


@router.post(
    "/",
    response_model=CentreResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new diagnostic centre (Admin only)",
    description="Creates a new diagnostic centre facility. Requires Admin role.",
)
async def create_centre(
    payload: CentreCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> CentreResponse:
    centre = await centre_service.create_centre(db, payload)
    return centre


@router.get(
    "/{centre_id}",
    response_model=CentreDetailResponse,
    summary="Get centre details with available tests and pricing (Cached via Redis)",
    description="Retrieves a diagnostic centre along with its offered tests and prices. Cached in Redis with 5 min TTL.",
)
async def get_centre(
    centre_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> CentreDetailResponse:
    return await centre_service.get_centre_cached(db, centre_id)


@router.patch(
    "/{centre_id}",
    response_model=CentreResponse,
    summary="Update a diagnostic centre (Admin only)",
    description="Updates centre name, location, contact number, or active status. Invalidates Redis cache. Requires Admin role.",
)
async def update_centre(
    centre_id: uuid.UUID,
    payload: CentreUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> CentreResponse:
    centre = await centre_service.update_centre(db, centre_id, payload)
    return centre


@router.delete(
    "/{centre_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Deactivate a diagnostic centre (Admin only)",
    description="Soft-deactivates a diagnostic centre facility. Invalidates Redis cache. Requires Admin role.",
)
async def delete_centre(
    centre_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    await centre_service.delete_centre(db, centre_id)
    return None


@router.post(
    "/{centre_id}/tests",
    response_model=CentreTestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Link a diagnostic test to a centre with pricing (Admin only)",
    description="Associates a diagnostic test with this centre, specifying the test price. Invalidates Redis cache. Requires Admin role.",
)
async def link_test_to_centre(
    centre_id: uuid.UUID,
    payload: CentreTestLinkRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> CentreTestResponse:
    centre_test = await centre_service.link_test_to_centre(db, centre_id, payload)
    result = await db.execute(
        select(CentreTest)
        .options(selectinload(CentreTest.test))
        .where(CentreTest.id == centre_test.id)
    )
    return result.scalar_one()


@router.patch(
    "/{centre_id}/tests/{test_id}",
    response_model=CentreTestResponse,
    summary="Update test price or availability at a centre (Admin only)",
    description="Updates the custom price or availability of a test at this centre. Invalidates Redis cache. Requires Admin role.",
)
async def update_centre_test_pricing(
    centre_id: uuid.UUID,
    test_id: uuid.UUID,
    payload: CentreTestUpdatePriceRequest,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
) -> CentreTestResponse:
    centre_test = await centre_service.update_centre_test_pricing(db, centre_id, test_id, payload)
    return centre_test


@router.delete(
    "/{centre_id}/tests/{test_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Unlink a diagnostic test from a centre (Admin only)",
    description="Removes a test offering from a specific centre. Invalidates Redis cache. Requires Admin role.",
)
async def unlink_test_from_centre(
    centre_id: uuid.UUID,
    test_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    await centre_service.unlink_test_from_centre(db, centre_id, test_id)
    return None


@router.get(
    "/{centre_id}/tests",
    response_model=List[CentreTestResponse],
    summary="List tests offered by a diagnostic centre (Cached via Redis)",
    description="Returns all diagnostic tests offered by this specific centre along with their prices. Cached in Redis.",
)
async def get_centre_tests(
    centre_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> List[CentreTestResponse]:
    return await centre_service.get_tests_for_centre(db, centre_id)

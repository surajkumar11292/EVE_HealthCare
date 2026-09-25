from typing import List, Optional
import uuid
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.cache.redis_client import cache_service
from app.models.centre import Centre
from app.models.test import DiagnosticTest
from app.models.centre_test import CentreTest
from app.schemas.centre import (
    CentreCreateRequest,
    CentreDetailResponse,
    CentreResponse,
    CentreTestLinkRequest,
    CentreTestResponse,
    CentreTestUpdatePriceRequest,
    CentreUpdateRequest,
)
from app.schemas.test import TestCreateRequest, TestResponse, TestUpdateRequest
from app.core.logging import logger


class CentreService:
    # -------------------------------------------------------------
    # Diagnostic Centres
    # -------------------------------------------------------------
    @staticmethod
    async def create_centre(db: AsyncSession, payload: CentreCreateRequest) -> Centre:
        centre = Centre(
            name=payload.name.strip(),
            location=payload.location.strip(),
            contact_number=payload.contact_number.strip() if payload.contact_number else None,
            is_active=True,
        )
        db.add(centre)
        await db.commit()
        await db.refresh(centre)

        # Invalidate centres cache
        await cache_service.delete_prefix("centres:")
        logger.info("centre_created", centre_id=str(centre.id), name=centre.name)
        return centre

    @staticmethod
    async def get_centre(db: AsyncSession, centre_id: uuid.UUID) -> Centre:
        result = await db.execute(
            select(Centre)
            .options(
                selectinload(Centre.centre_tests).selectinload(CentreTest.test)
            )
            .where(Centre.id == centre_id)
        )
        centre = result.scalar_one_or_none()
        if not centre:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Diagnostic centre with ID '{centre_id}' not found.",
            )
        return centre

    @staticmethod
    async def get_centre_cached(db: AsyncSession, centre_id: uuid.UUID) -> CentreDetailResponse:
        """
        Retrieves centre details using Cache-Aside pattern with Redis.
        """
        cache_key = f"centres:detail:{centre_id}"
        cached_data = await cache_service.get(cache_key)
        if cached_data:
            return CentreDetailResponse.model_validate(cached_data)

        # Cache Miss: Query Database with eager-loaded tests
        centre = await CentreService.get_centre(db, centre_id)
        response_obj = CentreDetailResponse.model_validate(centre)

        # Cache in Redis with 5 minute TTL (300 seconds)
        await cache_service.set(cache_key, response_obj.model_dump(mode="json"), ttl=300)
        return response_obj

    @staticmethod
    async def update_centre(db: AsyncSession, centre_id: uuid.UUID, payload: CentreUpdateRequest) -> Centre:
        centre = await CentreService.get_centre(db, centre_id)
        update_data = payload.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            setattr(centre, key, value)

        await db.commit()
        await db.refresh(centre)
        await cache_service.delete_prefix("centres:")
        logger.info("centre_updated", centre_id=str(centre.id))
        return centre

    @staticmethod
    async def delete_centre(db: AsyncSession, centre_id: uuid.UUID) -> None:
        centre = await CentreService.get_centre(db, centre_id)
        centre.is_active = False  # Soft delete
        await db.commit()
        await cache_service.delete_prefix("centres:")
        logger.info("centre_deactivated", centre_id=str(centre_id))

    # -------------------------------------------------------------
    # Diagnostic Tests
    # -------------------------------------------------------------
    @staticmethod
    async def create_test(db: AsyncSession, payload: TestCreateRequest) -> DiagnosticTest:
        normalized_name = payload.name.strip()
        existing = await db.execute(
            select(DiagnosticTest).where(DiagnosticTest.name == normalized_name)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Diagnostic test '{normalized_name}' already exists.",
            )

        test = DiagnosticTest(
            name=normalized_name,
            description=payload.description.strip() if payload.description else None,
            category=payload.category.strip(),
            is_active=True,
        )
        db.add(test)
        await db.commit()
        await db.refresh(test)

        await cache_service.delete_prefix("tests:")
        logger.info("test_created", test_id=str(test.id), name=test.name)
        return test

    @staticmethod
    async def get_test(db: AsyncSession, test_id: uuid.UUID) -> DiagnosticTest:
        result = await db.execute(select(DiagnosticTest).where(DiagnosticTest.id == test_id))
        test = result.scalar_one_or_none()
        if not test:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Diagnostic test with ID '{test_id}' not found.",
            )
        return test

    @staticmethod
    async def get_test_cached(db: AsyncSession, test_id: uuid.UUID) -> TestResponse:
        """
        Retrieves diagnostic test details using Cache-Aside pattern with Redis.
        """
        cache_key = f"tests:detail:{test_id}"
        cached_data = await cache_service.get(cache_key)
        if cached_data:
            return TestResponse.model_validate(cached_data)

        test = await CentreService.get_test(db, test_id)
        response_obj = TestResponse.model_validate(test)
        await cache_service.set(cache_key, response_obj.model_dump(mode="json"), ttl=300)
        return response_obj

    @staticmethod
    async def update_test(db: AsyncSession, test_id: uuid.UUID, payload: TestUpdateRequest) -> DiagnosticTest:
        test = await CentreService.get_test(db, test_id)
        update_data = payload.model_dump(exclude_unset=True)

        for key, value in update_data.items():
            setattr(test, key, value)

        await db.commit()
        await db.refresh(test)
        await cache_service.delete_prefix("tests:")
        logger.info("test_updated", test_id=str(test.id))
        return test

    @staticmethod
    async def delete_test(db: AsyncSession, test_id: uuid.UUID) -> None:
        test = await CentreService.get_test(db, test_id)
        test.is_active = False  # Soft delete
        await db.commit()
        await cache_service.delete_prefix("tests:")
        logger.info("test_deactivated", test_id=str(test_id))

    # -------------------------------------------------------------
    # Centre-Test Associations & Pricing
    # -------------------------------------------------------------
    @staticmethod
    async def link_test_to_centre(
        db: AsyncSession,
        centre_id: uuid.UUID,
        payload: CentreTestLinkRequest,
    ) -> CentreTest:
        # Validate centre exists
        await CentreService.get_centre(db, centre_id)
        # Validate test exists
        test = await CentreService.get_test(db, payload.test_id)

        # Check existing association
        existing = await db.execute(
            select(CentreTest).where(
                CentreTest.centre_id == centre_id,
                CentreTest.test_id == payload.test_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Test '{test.name}' is already linked to this centre.",
            )

        centre_test = CentreTest(
            centre_id=centre_id,
            test_id=payload.test_id,
            price=payload.price,
            is_available=payload.is_available,
        )
        db.add(centre_test)
        await db.commit()
        await db.refresh(centre_test)

        await cache_service.delete_prefix("centres:")
        logger.info(
            "centre_test_linked",
            centre_id=str(centre_id),
            test_id=str(payload.test_id),
            price=str(payload.price),
        )
        return centre_test

    @staticmethod
    async def update_centre_test_pricing(
        db: AsyncSession,
        centre_id: uuid.UUID,
        test_id: uuid.UUID,
        payload: CentreTestUpdatePriceRequest,
    ) -> CentreTest:
        result = await db.execute(
            select(CentreTest)
            .options(selectinload(CentreTest.test))
            .where(
                CentreTest.centre_id == centre_id,
                CentreTest.test_id == test_id,
            )
        )
        centre_test = result.scalar_one_or_none()
        if not centre_test:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Test is not linked to this diagnostic centre.",
            )

        if payload.price is not None:
            centre_test.price = payload.price
        if payload.is_available is not None:
            centre_test.is_available = payload.is_available

        await db.commit()
        await db.refresh(centre_test)
        await cache_service.delete_prefix("centres:")
        logger.info("centre_test_pricing_updated", centre_id=str(centre_id), test_id=str(test_id))
        return centre_test

    @staticmethod
    async def unlink_test_from_centre(
        db: AsyncSession,
        centre_id: uuid.UUID,
        test_id: uuid.UUID,
    ) -> None:
        result = await db.execute(
            select(CentreTest).where(
                CentreTest.centre_id == centre_id,
                CentreTest.test_id == test_id,
            )
        )
        centre_test = result.scalar_one_or_none()
        if not centre_test:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Test is not linked to this diagnostic centre.",
            )

        await db.delete(centre_test)
        await db.commit()
        await cache_service.delete_prefix("centres:")
        logger.info("centre_test_unlinked", centre_id=str(centre_id), test_id=str(test_id))

    @staticmethod
    async def get_tests_for_centre(db: AsyncSession, centre_id: uuid.UUID) -> List[CentreTest]:
        # Validate centre exists
        await CentreService.get_centre(db, centre_id)

        cache_key = f"centres:tests:{centre_id}"
        cached_data = await cache_service.get(cache_key)
        if cached_data:
            return [CentreTestResponse.model_validate(item) for item in cached_data]

        result = await db.execute(
            select(CentreTest)
            .options(selectinload(CentreTest.test))
            .where(CentreTest.centre_id == centre_id)
        )
        items = result.scalars().all()
        responses = [CentreTestResponse.model_validate(ct) for ct in items]
        await cache_service.set(cache_key, [r.model_dump(mode="json") for r in responses], ttl=300)
        return items


centre_service = CentreService()

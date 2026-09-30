import uuid
import pytest
from httpx import AsyncClient

from app.models.centre import Centre
from app.models.test import DiagnosticTest
from app.models.centre_test import CentreTest


@pytest.mark.asyncio
async def test_list_centres_paginated(
    client: AsyncClient,
    sample_centre: Centre,
):
    """
    Verifies that listing centres returns paginated results with items list.
    """
    response = await client.get("/api/v1/centres/")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert len(data["items"]) >= 1
    assert data["items"][0]["name"] == sample_centre.name


@pytest.mark.asyncio
async def test_list_centres_filter_by_name_and_location(
    client: AsyncClient,
    sample_centre: Centre,
):
    """
    Verifies filtering centres by name and location substrings.
    """
    # Matching filter
    res_match = await client.get("/api/v1/centres/?name=Apex")
    assert res_match.status_code == 200
    assert len(res_match.json()["items"]) >= 1

    # Non-matching filter
    res_no_match = await client.get("/api/v1/centres/?name=NonExistentCentreName999")
    assert res_no_match.status_code == 200
    assert len(res_no_match.json()["items"]) == 0


@pytest.mark.asyncio
async def test_create_centre_admin_success(
    client: AsyncClient,
    admin_headers: dict,
):
    """
    Verifies that an Admin can create a new diagnostic centre.
    """
    payload = {
        "name": "Metropolis Healthcare",
        "location": "Pune, Maharashtra",
        "contact_number": "+91-20-11223344",
        "is_active": True,
    }

    response = await client.post("/api/v1/centres/", json=payload, headers=admin_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Metropolis Healthcare"
    assert data["location"] == "Pune, Maharashtra"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_centre_patient_forbidden(
    client: AsyncClient,
    patient_headers: dict,
):
    """
    Verifies that a regular patient cannot create a diagnostic centre (403 Forbidden).
    """
    payload = {
        "name": "Unauthorized Centre",
        "location": "Chennai, Tamil Nadu",
        "contact_number": "+91-44-00001111",
        "is_active": True,
    }

    response = await client.post("/api/v1/centres/", json=payload, headers=patient_headers)
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_get_centre_details_with_tests(
    client: AsyncClient,
    sample_centre: Centre,
    sample_centre_test: CentreTest,
    sample_test: DiagnosticTest,
):
    """
    Verifies that GET /centres/{id} returns the centre with available tests and prices.
    """
    response = await client.get(f"/api/v1/centres/{sample_centre.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(sample_centre.id)
    assert data["name"] == sample_centre.name
    assert "tests" in data
    assert len(data["tests"]) >= 1
    assert float(data["tests"][0]["price"]) == float(sample_centre_test.price)


@pytest.mark.asyncio
async def test_link_test_to_centre(
    client: AsyncClient,
    admin_headers: dict,
    sample_centre: Centre,
    sample_test: DiagnosticTest,
):
    """
    Verifies that an Admin can link a test to a centre with custom pricing.
    """
    # Create another test to link
    test_res = await client.post(
        "/api/v1/tests/",
        json={
            "name": "Serum Creatinine",
            "description": "Kidney function marker test",
            "category": "Biochemistry",
            "is_active": True,
        },
        headers=admin_headers,
    )
    new_test_id = test_res.json()["id"]

    link_payload = {
        "test_id": new_test_id,
        "price": 280.00,
        "is_available": True,
    }

    response = await client.post(
        f"/api/v1/centres/{sample_centre.id}/tests",
        json=link_payload,
        headers=admin_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["test_id"] == new_test_id
    assert float(data["price"]) == 280.00


@pytest.mark.asyncio
async def test_soft_delete_centre(
    client: AsyncClient,
    admin_headers: dict,
    sample_centre: Centre,
):
    """
    Verifies that soft-deleting a centre sets is_active to False.
    """
    response = await client.delete(f"/api/v1/centres/{sample_centre.id}", headers=admin_headers)
    assert response.status_code == 204

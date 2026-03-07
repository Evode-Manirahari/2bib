import pytest
import httpx
import respx
from pe import PeClient


def test_fhir_search_no_params(client, mock_api):
    mock_api.get("/fhir/Patient").mock(return_value=httpx.Response(200, json={
        "resourceType": "Bundle", "type": "searchset", "total": 0, "entry": []
    }))
    result = client.fhir.search("Patient")
    assert result["resourceType"] == "Bundle"
    assert result["total"] == 0


def test_fhir_search_with_params(client, mock_api):
    mock_api.get("/fhir/Observation").mock(return_value=httpx.Response(200, json={
        "resourceType": "Bundle", "type": "searchset", "total": 3
    }))
    result = client.fhir.search("Observation", _count=10, _page=1)
    assert result["total"] == 3


def test_fhir_read(client, mock_api):
    mock_api.get("/fhir/Patient/patient-1").mock(return_value=httpx.Response(200, json={
        "resourceType": "Patient", "id": "patient-1", "name": [{"family": "Smith"}]
    }))
    result = client.fhir.read("Patient", "patient-1")
    assert result["id"] == "patient-1"
    assert result["resourceType"] == "Patient"


def test_fhir_create(client, mock_api):
    resource = {"resourceType": "Patient", "name": [{"family": "Jones"}]}
    mock_api.post("/fhir/Patient").mock(return_value=httpx.Response(201, json={
        **resource, "id": "new-patient-id"
    }))
    result = client.fhir.create(resource)
    assert result["id"] == "new-patient-id"
    assert result["resourceType"] == "Patient"


def test_fhir_update(client, mock_api):
    resource = {"resourceType": "Patient", "id": "patient-1", "name": [{"family": "Updated"}]}
    mock_api.put("/fhir/Patient/patient-1").mock(return_value=httpx.Response(200, json=resource))
    result = client.fhir.update(resource)
    assert result["id"] == "patient-1"


def test_fhir_transaction(client, mock_api):
    bundle = {
        "resourceType": "Bundle",
        "type": "transaction",
        "entry": [{"request": {"method": "POST", "url": "Patient"}}]
    }
    mock_api.post("/fhir/Bundle").mock(return_value=httpx.Response(200, json={
        "resourceType": "Bundle", "type": "transaction-response"
    }))
    result = client.fhir.transaction(bundle)
    assert result["type"] == "transaction-response"


def test_fhir_search_returns_entries(client, mock_api):
    mock_api.get("/fhir/Condition").mock(return_value=httpx.Response(200, json={
        "resourceType": "Bundle", "type": "searchset", "total": 2,
        "entry": [
            {"resource": {"resourceType": "Condition", "id": "c1"}},
            {"resource": {"resourceType": "Condition", "id": "c2"}},
        ]
    }))
    result = client.fhir.search("Condition")
    assert len(result["entry"]) == 2

import pytest
import httpx
import respx
from pe import PeClient


def test_validate_valid_resource(client, mock_api):
    mock_api.post("/validate").mock(return_value=httpx.Response(200, json={
        "isValid": True, "errorCount": 0, "warningCount": 0,
        "errors": [], "durationMs": 45
    }))
    resource = {"resourceType": "Patient", "id": "p1"}
    result = client.validate.validate(resource)
    assert result["isValid"] is True
    assert result["errorCount"] == 0


def test_validate_with_profile_and_enrich(client, mock_api):
    mock_api.post("/validate").mock(return_value=httpx.Response(200, json={
        "isValid": True, "errorCount": 0, "warningCount": 1,
        "errors": [], "durationMs": 120, "profile": "us-core"
    }))
    resource = {"resourceType": "Patient"}
    result = client.validate.validate(resource, profile="us-core", enrich=True, mode="hl7")
    assert result["profile"] == "us-core"
    request = mock_api.calls.last.request
    import json
    body = json.loads(request.content)
    assert body["profile"] == "us-core"
    assert body["enrich"] is True
    assert body["mode"] == "hl7"


def test_validate_invalid_resource(client, mock_api):
    mock_api.post("/validate").mock(return_value=httpx.Response(200, json={
        "isValid": False, "errorCount": 2, "warningCount": 0,
        "errors": [
            {"severity": "error", "category": "MISSING_REQUIRED", "path": "Patient.id", "message": "Missing required field"},
            {"severity": "error", "category": "INVALID_VALUE", "path": "Patient.gender", "message": "Invalid gender value"},
        ],
        "durationMs": 50
    }))
    resource = {"resourceType": "Patient"}
    result = client.validate.validate(resource)
    assert result["isValid"] is False
    assert result["errorCount"] == 2
    assert len(result["errors"]) == 2


def test_fix_with_errors(client, mock_api):
    mock_api.post("/validate/fix").mock(return_value=httpx.Response(200, json={
        "explanation": "Added missing id field and corrected gender value",
        "correctedResource": {"resourceType": "Patient", "id": "generated-1", "gender": "male"},
        "changesApplied": ["Added id", "Corrected gender"]
    }))
    resource = {"resourceType": "Patient"}
    errors = [{"path": "Patient.id", "message": "Missing required field"}]
    result = client.validate.fix(resource, errors=errors)
    assert "explanation" in result
    assert len(result["changesApplied"]) == 2
    import json
    body = json.loads(mock_api.calls.last.request.content)
    assert "errors" in body


def test_fix_without_errors(client, mock_api):
    mock_api.post("/validate/fix").mock(return_value=httpx.Response(200, json={
        "explanation": "Auto-detected and fixed issues",
        "correctedResource": {"resourceType": "Patient", "id": "auto-1"},
        "changesApplied": ["Added id"]
    }))
    resource = {"resourceType": "Patient"}
    result = client.validate.fix(resource)
    assert result["explanation"] == "Auto-detected and fixed issues"
    import json
    body = json.loads(mock_api.calls.last.request.content)
    assert "errors" not in body


def test_profiles(client, mock_api):
    mock_api.get("/validate/profiles").mock(return_value=httpx.Response(200, json={
        "profiles": [
            {"id": "us-core", "name": "US Core", "description": "US Core profiles", "requiresJava": False},
            {"id": "davinci", "name": "DaVinci", "description": "DaVinci profiles", "requiresJava": True, "url": "http://hl7.org/fhir/us/davinci"},
        ]
    }))
    result = client.validate.profiles()
    assert len(result["profiles"]) == 2
    assert result["profiles"][0]["id"] == "us-core"

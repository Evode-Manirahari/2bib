import pytest
import httpx
import respx
import json
from pe import PeClient


PA_FIXTURE = {
    "id": "pa-123",
    "projectId": "proj-1",
    "payerProfile": "aetna",
    "currentStatus": "SUBMITTED",
    "timeline": [{"status": "SUBMITTED", "timestamp": "2024-01-01T00:00:00Z"}],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
}


def test_payers(client, mock_api):
    mock_api.get("/pa/payers").mock(return_value=httpx.Response(200, json={
        "payers": [
            {"id": "aetna", "name": "Aetna", "autoApproveRate": 0.7, "appealSuccessRate": 0.3,
             "requiresPeerToPeer": False, "denialReasons": []},
            {"id": "bcbs", "name": "BCBS", "autoApproveRate": 0.6, "appealSuccessRate": 0.4,
             "requiresPeerToPeer": True, "denialReasons": []},
        ]
    }))
    result = client.pa.payers()
    assert len(result["payers"]) == 2
    assert result["payers"][0]["name"] == "Aetna"


def test_submit_with_all_options(client, mock_api):
    mock_api.post("/pa/submit").mock(return_value=httpx.Response(200, json=PA_FIXTURE))
    result = client.pa.submit(
        "aetna",
        patient_ref="Patient/p1",
        icd10="M54.5",
        cpt_code="27447",
        scenario="approval"
    )
    assert result["id"] == "pa-123"
    assert result["currentStatus"] == "SUBMITTED"
    body = json.loads(mock_api.calls.last.request.content)
    assert body["payerId"] == "aetna"
    assert body["patientRef"] == "Patient/p1"
    assert body["icd10"] == "M54.5"
    assert body["cptCode"] == "27447"
    assert body["scenario"] == "approval"


def test_get(client, mock_api):
    mock_api.get("/pa/pa-123").mock(return_value=httpx.Response(200, json=PA_FIXTURE))
    result = client.pa.get("pa-123")
    assert result["id"] == "pa-123"
    assert result["payerProfile"] == "aetna"


def test_submit_info(client, mock_api):
    updated = {**PA_FIXTURE, "currentStatus": "RE_REVIEW"}
    mock_api.post("/pa/pa-123/info").mock(return_value=httpx.Response(200, json=updated))
    result = client.pa.submit_info("pa-123", "Here is the additional clinical information")
    assert result["currentStatus"] == "RE_REVIEW"
    body = json.loads(mock_api.calls.last.request.content)
    assert body["additionalInfo"] == "Here is the additional clinical information"


def test_appeal(client, mock_api):
    appealed = {**PA_FIXTURE, "currentStatus": "APPEAL_SUBMITTED"}
    mock_api.post("/pa/pa-123/appeal").mock(return_value=httpx.Response(200, json=appealed))
    result = client.pa.appeal("pa-123", "Medically necessary procedure", scenario="appeal_approved")
    assert result["currentStatus"] == "APPEAL_SUBMITTED"
    body = json.loads(mock_api.calls.last.request.content)
    assert body["reason"] == "Medically necessary procedure"
    assert body["scenario"] == "appeal_approved"


def test_appeal_without_scenario(client, mock_api):
    appealed = {**PA_FIXTURE, "currentStatus": "APPEAL_SUBMITTED"}
    mock_api.post("/pa/pa-123/appeal").mock(return_value=httpx.Response(200, json=appealed))
    client.pa.appeal("pa-123", "Necessary")
    body = json.loads(mock_api.calls.last.request.content)
    assert "scenario" not in body


def test_timeline(client, mock_api):
    mock_api.get("/pa/pa-123/timeline").mock(return_value=httpx.Response(200, json={
        "id": "pa-123",
        "currentStatus": "APPROVED",
        "timeline": [
            {"status": "SUBMITTED", "timestamp": "2024-01-01T00:00:00Z"},
            {"status": "APPROVED", "timestamp": "2024-01-02T00:00:00Z"},
        ],
        "total": 2
    }))
    result = client.pa.timeline("pa-123")
    assert result["currentStatus"] == "APPROVED"
    assert result["total"] == 2
    assert len(result["timeline"]) == 2

import pytest
import httpx
import respx
import json
from pe import PeClient


WORKFLOW_RUN_FIXTURE = {
    "id": "run-1",
    "projectId": "proj-1",
    "workflowName": "basic-fhir-test",
    "status": "PASSED",
    "steps": [
        {"name": "step1", "action": "fhir.read", "status": "pass", "durationMs": 45}
    ],
    "durationMs": 100,
    "createdAt": "2024-01-01T00:00:00Z"
}


def test_templates(client, mock_api):
    mock_api.get("/workflows/templates").mock(return_value=httpx.Response(200, json={
        "templates": [
            {"name": "basic", "description": "Basic FHIR workflow", "file": "basic.yaml"},
            {"name": "pa-flow", "description": "PA workflow", "file": "pa-flow.yaml"},
        ]
    }))
    result = client.workflows.templates()
    assert len(result["templates"]) == 2
    assert result["templates"][0]["name"] == "basic"


def test_template_by_name(client, mock_api):
    mock_api.get("/workflows/templates/basic").mock(return_value=httpx.Response(200, json={
        "template": {
            "name": "basic",
            "description": "Basic workflow",
            "steps": [{"name": "read-patient", "action": "fhir.read", "input": {"resourceType": "Patient"}}]
        }
    }))
    result = client.workflows.template("basic")
    assert result["template"]["name"] == "basic"
    assert len(result["template"]["steps"]) == 1


def test_run_with_template_name(client, mock_api):
    mock_api.post("/workflows/run").mock(return_value=httpx.Response(200, json=WORKFLOW_RUN_FIXTURE))
    result = client.workflows.run(template_name="basic-fhir-test")
    assert result["id"] == "run-1"
    assert result["status"] == "PASSED"
    body = json.loads(mock_api.calls.last.request.content)
    assert body["templateName"] == "basic-fhir-test"


def test_run_with_inline_template(client, mock_api):
    mock_api.post("/workflows/run").mock(return_value=httpx.Response(200, json={
        **WORKFLOW_RUN_FIXTURE,
        "workflowName": "inline-test",
        "status": "RUNNING"
    }))
    template = {
        "name": "inline-test",
        "steps": [{"name": "step1", "action": "fhir.search"}]
    }
    result = client.workflows.run(template=template, vars={"patientId": "p1"})
    assert result["workflowName"] == "inline-test"
    body = json.loads(mock_api.calls.last.request.content)
    assert body["template"]["name"] == "inline-test"
    assert body["vars"] == {"patientId": "p1"}


def test_list_workflows(client, mock_api):
    mock_api.get("/workflows").mock(return_value=httpx.Response(200, json={
        "data": [WORKFLOW_RUN_FIXTURE],
        "total": 1, "page": 1, "pageSize": 20, "hasMore": False
    }))
    result = client.workflows.list()
    assert result["total"] == 1
    assert len(result["data"]) == 1


def test_list_workflows_with_pagination(client, mock_api):
    mock_api.get("/workflows").mock(return_value=httpx.Response(200, json={
        "data": [], "total": 50, "page": 3, "pageSize": 5, "hasMore": True
    }))
    result = client.workflows.list(page=3, page_size=5)
    assert result["page"] == 3
    assert result["hasMore"] is True


def test_get_workflow(client, mock_api):
    mock_api.get("/workflows/run-1").mock(return_value=httpx.Response(200, json=WORKFLOW_RUN_FIXTURE))
    result = client.workflows.get("run-1")
    assert result["id"] == "run-1"
    assert result["status"] == "PASSED"
    assert len(result["steps"]) == 1

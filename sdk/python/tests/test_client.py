import pytest
import httpx
import respx
from pe import PeClient, PeApiError


def test_me(client, mock_api):
    mock_api.get("/me").mock(return_value=httpx.Response(200, json={
        "id": "key-1", "prefix": "pe_test_", "tier": "STARTER",
        "callCount": 42, "rateLimit": 1000, "projectId": "proj-1",
        "createdAt": "2024-01-01"
    }))
    result = client.me()
    assert result["tier"] == "STARTER"
    assert result["callCount"] == 42


def test_logs_no_params(client, mock_api):
    mock_api.get("/logs").mock(return_value=httpx.Response(200, json={
        "data": [], "total": 0, "page": 1, "pageSize": 20, "hasMore": False
    }))
    result = client.logs()
    assert result["total"] == 0
    assert result["hasMore"] is False


def test_logs_with_params(client, mock_api):
    mock_api.get("/logs").mock(return_value=httpx.Response(200, json={
        "data": [], "total": 5, "page": 2, "pageSize": 10, "hasMore": False
    }))
    result = client.logs(page=2, page_size=10, method="GET", min_status=200, max_status=299)
    assert result["page"] == 2
    assert result["pageSize"] == 10


def test_missing_api_key_raises_value_error():
    with pytest.raises(ValueError, match="api_key is required"):
        PeClient(api_key="")


def test_error_response_raises_pe_api_error(client, mock_api):
    mock_api.get("/me").mock(return_value=httpx.Response(404, json={
        "error": "Resource not found", "code": "NOT_FOUND"
    }))
    with pytest.raises(PeApiError) as exc_info:
        client.me()
    assert exc_info.value.status == 404
    assert exc_info.value.code == "NOT_FOUND"
    assert "Resource not found" in str(exc_info.value)


def test_unauthorized_raises_pe_api_error(mock_api):
    client = PeClient(api_key="bad-key")
    mock_api.get("/me").mock(return_value=httpx.Response(401, json={
        "error": "Unauthorized", "code": "UNAUTHORIZED"
    }))
    with pytest.raises(PeApiError) as exc_info:
        client.me()
    assert exc_info.value.status == 401


def test_context_manager():
    with PeClient(api_key="test-key") as client:
        assert client is not None


def test_custom_base_url():
    client = PeClient(api_key="test-key", base_url="https://api.pe.dev")
    assert client is not None


def test_authorization_header_sent(mock_api):
    client = PeClient(api_key="my-secret-key")
    mock_api.get("/me").mock(return_value=httpx.Response(200, json={"id": "k1"}))
    client.me()
    request = mock_api.calls.last.request
    assert request.headers["Authorization"] == "Bearer my-secret-key"

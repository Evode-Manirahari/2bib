import pytest
import httpx
import respx
from pe import PeClient

BASE = "http://localhost:3001/v1"


@pytest.fixture
def client():
    return PeClient(api_key="pe_test_abc123")


@pytest.fixture
def mock_api():
    with respx.mock(base_url=BASE, assert_all_called=False) as mock:
        yield mock

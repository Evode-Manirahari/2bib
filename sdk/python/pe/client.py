import httpx
from typing import Optional
from .exceptions import PeApiError, PeTimeoutError
from .resources.fhir import FhirClient
from .resources.validate import ValidateClient
from .resources.pa import PAClient
from .resources.workflows import WorkflowsClient


def _raise_for_status(response: httpx.Response) -> None:
    if response.is_error:
        try:
            response.read()
            body = response.json()
            msg = body.get("error", f"HTTP {response.status_code}")
            code = body.get("code")
        except Exception:
            msg = f"HTTP {response.status_code}"
            code = None
        raise PeApiError(msg, response.status_code, code)


class PeClient:
    def __init__(self, api_key: str, *, base_url: str = "http://localhost:3001", timeout: float = 30.0):
        if not api_key:
            raise ValueError("api_key is required")
        self._http = httpx.Client(
            base_url=f"{base_url.rstrip('/')}/v1",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            timeout=timeout,
            event_hooks={"response": [lambda r: _raise_for_status(r)]},
        )
        self.fhir = FhirClient(self._http)
        self.validate = ValidateClient(self._http)
        self.pa = PAClient(self._http)
        self.workflows = WorkflowsClient(self._http)

    def me(self) -> dict:
        return self._http.get("/me").json()

    def logs(self, *, page: int = 1, page_size: int = 20,
             method: Optional[str] = None,
             min_status: Optional[int] = None,
             max_status: Optional[int] = None) -> dict:
        params: dict = {"page": page, "pageSize": page_size}
        if method:
            params["method"] = method
        if min_status is not None:
            params["minStatus"] = min_status
        if max_status is not None:
            params["maxStatus"] = max_status
        return self._http.get("/logs", params=params).json()

    def close(self):
        self._http.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

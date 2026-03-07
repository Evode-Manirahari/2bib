import httpx
from typing import Optional, List


class ValidateClient:
    def __init__(self, http: httpx.Client):
        self._http = http

    def validate(self, resource: dict, *, profile: Optional[str] = None,
                 enrich: bool = False, mode: str = "auto") -> dict:
        body = {"resource": resource, "enrich": enrich, "mode": mode}
        if profile:
            body["profile"] = profile
        return self._http.post("/validate", json=body).json()

    def fix(self, resource: dict, errors: Optional[List[dict]] = None) -> dict:
        body: dict = {"resource": resource}
        if errors is not None:
            body["errors"] = errors
        return self._http.post("/validate/fix", json=body).json()

    def profiles(self) -> dict:
        return self._http.get("/validate/profiles").json()

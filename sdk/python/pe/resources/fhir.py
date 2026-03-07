from typing import Any
import httpx


class FhirClient:
    def __init__(self, http: httpx.Client):
        self._http = http

    def search(self, resource_type: str, **params: Any) -> dict:
        return self._http.get(f"/fhir/{resource_type}", params=params).json()

    def read(self, resource_type: str, id: str) -> dict:
        return self._http.get(f"/fhir/{resource_type}/{id}").json()

    def create(self, resource: dict) -> dict:
        rt = resource["resourceType"]
        return self._http.post(f"/fhir/{rt}", json=resource).json()

    def update(self, resource: dict) -> dict:
        rt = resource["resourceType"]
        rid = resource["id"]
        return self._http.put(f"/fhir/{rt}/{rid}", json=resource).json()

    def transaction(self, bundle: dict) -> dict:
        return self._http.post("/fhir/Bundle", json=bundle).json()

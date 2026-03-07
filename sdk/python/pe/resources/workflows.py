import httpx
from typing import Optional


class WorkflowsClient:
    def __init__(self, http: httpx.Client):
        self._http = http

    def templates(self) -> dict:
        return self._http.get("/workflows/templates").json()

    def template(self, name: str) -> dict:
        return self._http.get(f"/workflows/templates/{name}").json()

    def run(self, *, template_name: Optional[str] = None,
            template: Optional[dict] = None,
            vars: Optional[dict] = None) -> dict:
        body: dict = {}
        if template_name:
            body["templateName"] = template_name
        if template:
            body["template"] = template
        if vars:
            body["vars"] = vars
        return self._http.post("/workflows/run", json=body).json()

    def list(self, *, page: int = 1, page_size: int = 20) -> dict:
        return self._http.get("/workflows", params={"page": page, "pageSize": page_size}).json()

    def get(self, id: str) -> dict:
        return self._http.get(f"/workflows/{id}").json()

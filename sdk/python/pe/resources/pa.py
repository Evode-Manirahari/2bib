import httpx
from typing import Optional


class PAClient:
    def __init__(self, http: httpx.Client):
        self._http = http

    def payers(self) -> dict:
        return self._http.get("/pa/payers").json()

    def submit(self, payer_id: str, *, patient_ref: Optional[str] = None,
               icd10: Optional[str] = None, cpt_code: Optional[str] = None,
               scenario: Optional[str] = None) -> dict:
        body = {"payerId": payer_id}
        if patient_ref:
            body["patientRef"] = patient_ref
        if icd10:
            body["icd10"] = icd10
        if cpt_code:
            body["cptCode"] = cpt_code
        if scenario:
            body["scenario"] = scenario
        return self._http.post("/pa/submit", json=body).json()

    def get(self, id: str) -> dict:
        return self._http.get(f"/pa/{id}").json()

    def submit_info(self, id: str, additional_info: str) -> dict:
        return self._http.post(f"/pa/{id}/info", json={"additionalInfo": additional_info}).json()

    def appeal(self, id: str, reason: str, scenario: Optional[str] = None) -> dict:
        body: dict = {"reason": reason}
        if scenario:
            body["scenario"] = scenario
        return self._http.post(f"/pa/{id}/appeal", json=body).json()

    def timeline(self, id: str) -> dict:
        return self._http.get(f"/pa/{id}/timeline").json()

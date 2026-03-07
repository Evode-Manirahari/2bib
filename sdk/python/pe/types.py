from typing import TypedDict, Optional, List, Any

class ApiKeyInfo(TypedDict):
    id: str
    prefix: str
    tier: str
    callCount: int
    rateLimit: int
    projectId: str
    createdAt: str
    lastUsedAt: Optional[str]

class RequestLog(TypedDict):
    id: str; method: str; path: str; statusCode: int; durationMs: int
    payerTarget: Optional[str]; resourceType: Optional[str]
    error: Optional[str]; createdAt: str

class LogsResponse(TypedDict):
    data: List[RequestLog]; total: int; page: int; pageSize: int; hasMore: bool

class EnrichedError(TypedDict):
    severity: str; category: str; path: str; message: str
    suggestion: Optional[str]; igLink: Optional[str]

class ValidationResult(TypedDict):
    isValid: bool; errorCount: int; warningCount: int
    errors: List[EnrichedError]; profile: Optional[str]
    engine: Optional[str]; durationMs: int; cached: Optional[bool]

class FixResult(TypedDict):
    explanation: str; correctedResource: dict; changesApplied: List[str]

class ValidateProfile(TypedDict):
    id: str; name: str; description: str; requiresJava: bool; url: Optional[str]

class PATimelineEvent(TypedDict):
    status: str; timestamp: str; note: Optional[str]; actor: Optional[str]

class PASimulation(TypedDict):
    id: str; projectId: str; payerProfile: str; scenario: Optional[str]
    currentStatus: str; claim: Optional[dict]; response: Optional[dict]
    timeline: List[PATimelineEvent]; createdAt: str; updatedAt: str

class PayerProfile(TypedDict):
    id: str; name: str; autoApproveRate: float; appealSuccessRate: float
    requiresPeerToPeer: bool; denialReasons: List[dict]

class StepResult(TypedDict):
    name: str; action: str; status: str; durationMs: int
    output: Optional[Any]; error: Optional[str]

class WorkflowRun(TypedDict):
    id: str; projectId: str; workflowName: str; status: str
    steps: List[StepResult]; durationMs: Optional[int]; createdAt: str

class WorkflowTemplate(TypedDict):
    name: str; description: Optional[str]
    vars: Optional[dict]; steps: List[dict]

class WorkflowTemplateInfo(TypedDict):
    name: str; description: str; file: str

class WorkflowRunsResponse(TypedDict):
    data: List[WorkflowRun]; total: int; page: int; pageSize: int; hasMore: bool

class FhirSearchResponse(TypedDict):
    resourceType: str; type: str; total: Optional[int]; entry: Optional[List[dict]]

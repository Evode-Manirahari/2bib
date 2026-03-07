class PeApiError(Exception):
    def __init__(self, message: str, status: int, code: str | None = None):
        super().__init__(message)
        self.status = status
        self.code = code

class PeTimeoutError(PeApiError):
    pass

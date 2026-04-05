from typing import Any

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse


def _error_body(code: str, message: str, details: Any = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        payload["details"] = details
    return payload


async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        code = exc.detail.get("code", "HTTP_ERROR")
        message = exc.detail.get("message", "Request failed.")
        details = exc.detail.get("details")
    else:
        code = "HTTP_ERROR"
        message = str(exc.detail) if exc.detail else "Request failed."
        details = None

    return JSONResponse(
        status_code=exc.status_code,
        content=_error_body(code=code, message=message, details=details),
    )


async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=_error_body(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected error occurred.",
            details={"error_type": exc.__class__.__name__},
        ),
    )


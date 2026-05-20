import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.requests import Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.geodata import router as geodata_router
from app.api.health import router as health_router
from app.api.routes.analysis import router as analysis_router
from app.api.routes.bookings import router as bookings_router
from app.api.routes.geodata import router as geodata_tools_router
from app.api.routes.favorites import router as favorites_router
from app.api.routes.route import router as route_router
from app.api.routes.system import router as system_router
from app.api.routes.vertiports import router as vertiports_router
from app.api.routes.vertiport_reviews import router as vertiport_reviews_router
from app.api.routes import auth, users
from app.core.config import get_settings
from app.core.errors import http_exception_handler, unhandled_exception_handler
from app.core.logging import configure_logging
from app.core.runtime import runtime_state


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    logger = logging.getLogger("app.lifecycle")
    settings = get_settings()
    logger.info("Application startup (%s).", settings.app_env)
    yield
    logger.info("Application shutdown.")


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    @app.middleware("http")
    async def runtime_controls(request: Request, call_next):
        start = time.perf_counter()
        if not runtime_state.is_request_allowed(request.url.path):
            snapshot = runtime_state.maintenance_snapshot()
            return JSONResponse(
                status_code=503,
                content={
                    "code": "MAINTENANCE_MODE",
                    "message": snapshot["message"],
                    "since": snapshot["since"].isoformat() if snapshot["since"] else None,
                },
            )

        response = await call_next(request)
        latency_ms = (time.perf_counter() - start) * 1000.0
        runtime_state.record_request(
            request.method,
            request.url.path,
            response.status_code,
            latency_ms,
        )
        response.headers["X-SkyPort-Latency-Ms"] = f"{latency_ms:.2f}"
        return response

    app.include_router(health_router)
    app.include_router(geodata_router, prefix="/api")
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(users.router, prefix="/api/users", tags=["users"])
    app.include_router(geodata_tools_router, prefix="/api/geodata", tags=["geodata"])
    app.include_router(system_router, prefix="/api/system", tags=["system"])
    app.include_router(analysis_router, prefix="/api/analysis", tags=["analysis"])
    app.include_router(bookings_router, prefix="/api/bookings", tags=["bookings"])
    app.include_router(route_router, prefix="/api/route", tags=["route"])
    app.include_router(vertiports_router, prefix="/api/vertiports", tags=["vertiports"])
    app.include_router(vertiport_reviews_router, prefix="/api/vertiport-reviews", tags=["vertiport-reviews"])
    app.include_router(favorites_router, prefix="/api/favorites", tags=["favorites"])

    @app.get("/", tags=["system"])
    async def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "environment": settings.app_env,
            "status": "ok",
        }

    return app


app = create_app()

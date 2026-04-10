import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException

from app.api.geodata import router as geodata_router
from app.api.health import router as health_router
from app.core.config import get_settings
from app.core.errors import http_exception_handler, unhandled_exception_handler
from app.core.logging import configure_logging


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
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
    app.include_router(health_router)
    app.include_router(geodata_router, prefix="/api")

    @app.get("/", tags=["system"])
    async def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "environment": settings.app_env,
            "status": "ok",
        }

    return app


app = create_app()

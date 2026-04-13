import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException

from app.api.health import router as health_router
from app.api.routes import auth, users
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

    from fastapi.middleware.cors import CORSMiddleware
    app = FastAPI(
        title=settings.app_name,
        lifespan=lifespan,
    )
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # Allows all origins
        allow_credentials=True,
        allow_methods=["*"],  # Allows all methods
        allow_headers=["*"],  # Allows all headers
    )
    
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
    app.include_router(health_router)
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(users.router, prefix="/api/users", tags=["users"])
    
    from app.api.routes.geodata import router as geodata_router
    app.include_router(geodata_router, prefix="/api/geodata", tags=["geodata"])
    
    from app.api.routes.analysis import router as analysis_router
    app.include_router(analysis_router, prefix="/api/analysis", tags=["analysis"])

    @app.get("/", tags=["system"])
    async def root() -> dict[str, str]:
        return {
            "service": settings.app_name,
            "environment": settings.app_env,
            "status": "ok",
        }

    return app


app = create_app()

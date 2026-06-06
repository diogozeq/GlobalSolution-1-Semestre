"""OrbitGuard AI - FastAPI application entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import api_router
from app.core.config import settings
from app.db.init_db import init_db

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("orbitguard")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("OrbitGuard database ready.")
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="POC de monitoramento de risco climático com dados orbitais, IA Generativa e RAG.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": "Erro interno", "detail": str(exc)},
    )


@app.get("/")
def root() -> dict:
    return {"app": settings.app_name, "version": settings.version, "docs": "/docs"}


app.include_router(api_router)

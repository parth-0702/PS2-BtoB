"""
main.py — SiteScope FastAPI application entry point.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).parent.parent / ".env", override=False)

from app.routers import cities, score, analysis, ai, upload  # noqa: E402

app = FastAPI(
    title="SiteScope API",
    description="AI-powered geospatial site readiness analyser — Bit N Build '26",
    version="1.0.0",
)

# Allow the Vite dev server to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cities.router)
app.include_router(score.router)
app.include_router(analysis.router)
app.include_router(ai.router)
app.include_router(upload.router)


@app.get("/")
def root():
    return {
        "name": "SiteScope API",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}

"""FastAPI application entry point."""

import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.auth import router as auth_router
from app.api.v1.tutor import router as tutor_router
from app.api.v1.staff import router as staff_router
from app.api.v1.learning_needs import router as learning_needs_router
from app.api.v1.recommendations import router as recommendations_router
from app.api.v1.private_requests import router as private_requests_router
from app.api.v1.classes import router as classes_router
from app.api.v1.payments import router as payments_router
from app.api.v1.subjects import router as subjects_router
from app.api.v1.schedules import router as schedules_router
from app.api.v1.storage import router as storage_router
from app.api.v1.chat import router as chat_router
from app.api.v1.admin import router as admin_router
from app.api.v1.webhooks import router as webhooks_router
from app.core.config import settings

app = FastAPI(
    title=settings.APP_NAME,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────
API_V1 = "/api/v1"

app.include_router(auth_router, prefix=API_V1)
app.include_router(tutor_router, prefix=API_V1)
app.include_router(staff_router, prefix=API_V1)
app.include_router(learning_needs_router, prefix=API_V1)
app.include_router(recommendations_router, prefix=API_V1)
app.include_router(private_requests_router, prefix=API_V1)
app.include_router(classes_router, prefix=API_V1)
app.include_router(payments_router, prefix=API_V1)
app.include_router(webhooks_router, prefix=API_V1)
app.include_router(subjects_router, prefix=API_V1)
app.include_router(schedules_router, prefix=API_V1)
app.include_router(admin_router, prefix=API_V1)
app.include_router(chat_router, prefix=API_V1)
app.include_router(storage_router, prefix=API_V1)

# Serve uploaded files locally
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

seed_dir = Path(__file__).resolve().parents[2] / "seed"
if seed_dir.exists():
    app.mount("/seed", StaticFiles(directory=seed_dir), name="seed")

# ── Health ───────────────────────────────────────────────
@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "message": "Lumin API is running"}

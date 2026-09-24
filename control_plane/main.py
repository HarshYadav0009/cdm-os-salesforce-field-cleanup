"""
CDM-OS — Control Plane FastAPI Application

The main entry point for the CDM-OS Control Plane API server.
This is the brain of the system: it receives agent proposals, evaluates them
against the Policy Engine, routes them for human approval, and records
every action in the immutable audit log.

Run locally:
    uvicorn control_plane.main:app --reload --port 8000

Run via Docker:
    docker compose up control-plane
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from control_plane.config import settings
from control_plane.policy_engine import policy_engine
from control_plane.routes import (
    proposals_router,
    agents_router,
    tools_router,
    audit_router,
)


# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, settings.CDM_LOG_LEVEL),
    format="%(asctime)s │ %(name)-24s │ %(levelname)-7s │ %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("cdm.main")


# ── Lifespan (startup / shutdown hooks) ───────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: load policies. Shutdown: cleanup."""
    logger.info("=" * 60)
    logger.info("CDM-OS Control Plane starting up")
    logger.info(f"  Environment : {settings.CDM_ENV}")
    logger.info(f"  Policy mode : {settings.POLICY_MODE}")
    logger.info(f"  Database    : {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
    logger.info("=" * 60)

    # Load policy definitions from YAML files
    rule_count = policy_engine.load_policies()
    logger.info(f"Policy Engine loaded {rule_count} rules")

    yield  # App is running

    logger.info("CDM-OS Control Plane shutting down")


# ── FastAPI Application ───────────────────────────────────────
app = FastAPI(
    title="CDM-OS Control Plane",
    description=(
        "Enterprise Control Plane for Autonomous AI Agents. "
        "The model PROPOSES actions. CDM-OS DECIDES whether those actions are allowed. "
        "The tool EXECUTES the authorized action."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS (allow Governance UI frontend) ───────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server (Dev 3)
        "http://localhost:3000",  # Alternative React port
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register API Routers ─────────────────────────────────────
app.include_router(proposals_router, prefix="/api/v1")
app.include_router(agents_router, prefix="/api/v1")
app.include_router(tools_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")


# ── Health Check ──────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health_check():
    """Health check endpoint for Docker/monitoring."""
    return {
        "status": "ok",
        "environment": settings.CDM_ENV,
        "version": "0.1.0",
        "policy_rules_loaded": len(policy_engine.rules),
    }


@app.get("/", tags=["System"])
def root():
    """API root — shows available endpoints."""
    return {
        "service": "CDM-OS Control Plane",
        "version": "0.1.0",
        "docs": "/docs",
        "endpoints": {
            "proposals": "/api/v1/proposals",
            "agents": "/api/v1/agents",
            "tools": "/api/v1/tools",
            "audit": "/api/v1/audit",
            "health": "/health",
        },
    }

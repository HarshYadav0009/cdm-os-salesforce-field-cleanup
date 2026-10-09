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
from control_plane.database import Base, engine, SessionLocal
from control_plane.models import Agent, ToolDefinition, ToolTier
from control_plane.policy_engine import policy_engine
from control_plane.routes import (
    proposals_router,
    agents_router,
    tools_router,
    audit_router,
    policies_router,
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
    """Startup: initialize DB tables, seed default tools/agents, load policies."""
    logger.info("=" * 60)
    logger.info("CDM-OS Control Plane starting up")
    logger.info(f"  Environment : {settings.CDM_ENV}")
    logger.info(f"  Policy mode : {settings.POLICY_MODE}")
    logger.info(f"  Database    : {settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_DB}")
    logger.info("=" * 60)

    # Initialize Database Tables
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables initialized successfully.")
    except Exception as e:
        logger.warning(f"Database table initialization notice: {e}")

    # Seed Default Agent & Tools if missing
    try:
        with SessionLocal() as db:
            if not db.query(Agent).filter(Agent.agent_id == "field-cleanup-agent").first():
                agent = Agent(
                    agent_id="field-cleanup-agent",
                    name="Salesforce Field Cleanup Agent",
                    version="1.0.0",
                    model_primary="gemini-3.6-flash",
                )
                db.add(agent)

            tools_to_seed = [
                ("salesforce_full_field_assessment", "Full Field Safety Assessment", "Run metadata, population, and reference scan report", ToolTier.TIER_1),
                ("salesforce_describe_object", "Describe Object Metadata", "Retrieve object field definitions", ToolTier.TIER_1),
                ("salesforce_query_field_usage", "Query Field Record Population", "Calculate record population %", ToolTier.TIER_1),
                ("salesforce_scan_apex_references", "Scan Apex References", "Find references in Apex, Flows, Triggers, and Lightning components", ToolTier.TIER_1),
                ("salesforce_backup_field_def", "Backup Field Definition", "Create a metadata snapshot before changing a custom field", ToolTier.TIER_2),
                ("salesforce_deprecate_field", "Deprecate Custom Field", "Back up and mark a custom field description as deprecated; leaves field access unchanged", ToolTier.TIER_2),
                ("salesforce_delete_field", "Delete Custom Field", "Permanently delete custom field", ToolTier.TIER_3),
            ]
            for tool_id, name, desc, tier in tools_to_seed:
                if not db.query(ToolDefinition).filter(ToolDefinition.tool_id == tool_id).first():
                    db.add(ToolDefinition(
                        tool_id=tool_id,
                        name=name,
                        description=desc,
                        tier=tier,
                        mcp_server="salesforce-mcp",
                    ))
            db.commit()
            logger.info("Default agent and tool definitions seeded successfully.")
    except Exception as e:
        logger.warning(f"Seed step notice: {e}")

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
app.include_router(policies_router, prefix="/api/v1")


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
            "policies": "/api/v1/policies",
            "health": "/health",
        },
    }

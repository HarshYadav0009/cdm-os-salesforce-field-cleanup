"""
CDM-OS — API Routes: Agents

CRUD for registered agent definitions.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from control_plane.database import get_db
from control_plane.models import Agent, AgentStatus
from control_plane.schemas import AgentCreate, AgentResponse

logger = logging.getLogger("cdm.api.agents")

router = APIRouter(prefix="/agents", tags=["Agents"])


@router.post("/", response_model=AgentResponse, status_code=201)
def register_agent(body: AgentCreate, db: Session = Depends(get_db)):
    """Register a new agent in the Control Plane."""
    existing = db.query(Agent).filter(Agent.agent_id == body.agent_id).first()
    if existing:
        raise HTTPException(409, f"Agent '{body.agent_id}' already registered")

    agent = Agent(
        agent_id=body.agent_id,
        name=body.name,
        version=body.version,
        description=body.description,
        owner=body.owner,
        model_primary=body.model_primary,
        model_fallback=body.model_fallback,
        config_yaml=body.config_yaml,
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    logger.info(f"Agent registered: {agent.agent_id}")
    return agent


@router.get("/", response_model=list[AgentResponse])
def list_agents(db: Session = Depends(get_db)):
    """List all registered agents."""
    return db.query(Agent).order_by(Agent.created_at.desc()).all()


@router.get("/{agent_id}", response_model=AgentResponse)
def get_agent(agent_id: str, db: Session = Depends(get_db)):
    """Get a specific agent by its agent_id."""
    agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
    if not agent:
        raise HTTPException(404, f"Agent '{agent_id}' not found")
    return agent


@router.patch("/{agent_id}/status")
def update_agent_status(agent_id: str, status: str, db: Session = Depends(get_db)):
    """Update agent status (IDLE, RUNNING, PAUSED, ERROR, TERMINATED)."""
    agent = db.query(Agent).filter(Agent.agent_id == agent_id).first()
    if not agent:
        raise HTTPException(404, f"Agent '{agent_id}' not found")

    try:
        new_status = AgentStatus(status)
    except ValueError:
        raise HTTPException(400, f"Invalid status. Must be one of: {[s.value for s in AgentStatus]}")

    agent.status = new_status
    db.commit()
    return {"agent_id": agent_id, "status": new_status.value}

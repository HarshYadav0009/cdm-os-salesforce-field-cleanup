"""
CDM-OS — API Routes: Proposals

Handles the full lifecycle of agent tool-call proposals:
1. Agent submits a proposal (POST)
2. Policy Engine evaluates it
3. If Tier-3 → status becomes PENDING_HUMAN_APPROVAL
4. Human approves/rejects via Governance UI (PUT)
5. Approved proposals are released for tool execution
"""

import logging
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from control_plane.database import get_db
from control_plane.models import Proposal, ToolDefinition, Agent, ProposalStatus, ToolTier
from control_plane.schemas import (
    ProposalCreate,
    ProposalResponse,
    HumanDecision,
    ProposalStatusEnum,
)
from control_plane.policy_engine import policy_engine
from control_plane.audit import record_event

logger = logging.getLogger("cdm.api.proposals")

router = APIRouter(prefix="/proposals", tags=["Proposals"])


# ── POST /proposals — Agent submits a new proposal ────────────
@router.post("", response_model=ProposalResponse, status_code=201, include_in_schema=False)
@router.post("/", response_model=ProposalResponse, status_code=201)
def create_proposal(body: ProposalCreate, db: Session = Depends(get_db)):
    """
    Accept a tool-call proposal from an agent.

    Flow:
    1. Validate agent and tool exist
    2. Run Policy Engine evaluation
    3. Set status based on policy result
    4. Record audit log entry
    """
    # Verify agent is registered
    agent = db.query(Agent).filter(Agent.agent_id == body.agent_id).first()
    if not agent:
        raise HTTPException(404, f"Agent '{body.agent_id}' not registered")

    # Verify tool is registered
    tool = db.query(ToolDefinition).filter(ToolDefinition.tool_id == body.tool_id).first()
    if not tool:
        raise HTTPException(404, f"Tool '{body.tool_id}' not registered")

    # ── Run Policy Engine ─────────────────────────────────────
    decision = policy_engine.evaluate(
        tool_id=body.tool_id,
        tier=ToolTier(tool.tier.value),
        input_payload=body.input_payload,
    )

    # Determine status based on policy result
    if not decision.allowed:
        status = ProposalStatus.POLICY_DENIED
    elif decision.requires_human_approval:
        status = ProposalStatus.PENDING_HUMAN_APPROVAL
    else:
        status = ProposalStatus.POLICY_APPROVED

    # Create proposal record
    proposal = Proposal(
        agent_id=body.agent_id,
        tool_id=body.tool_id,
        tier=tool.tier,
        input_payload=body.input_payload,
        status=status,
        policy_result=decision.to_dict(),
    )
    db.add(proposal)
    db.flush()

    # Audit: record the proposal creation and policy check
    record_event(db, "PROPOSAL_CREATED", body.agent_id, {
        "tool_id": body.tool_id,
        "tier": tool.tier.value,
        "input_payload": body.input_payload,
    }, proposal_id=proposal.id)

    record_event(db, "POLICY_CHECK", "system", {
        "decision": decision.to_dict(),
        "resulting_status": status.value,
    }, proposal_id=proposal.id)

    db.commit()
    db.refresh(proposal)

    logger.info(f"Proposal {proposal.id} created: tool={body.tool_id} status={status.value}")
    return proposal


# ── GET /proposals — List proposals with optional filters ─────
@router.get("", response_model=list[ProposalResponse], include_in_schema=False)
@router.get("/", response_model=list[ProposalResponse])
def list_proposals(
    status: Optional[ProposalStatusEnum] = Query(None, description="Filter by status"),
    agent_id: Optional[str] = Query(None, description="Filter by agent"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List all proposals with optional filtering."""
    query = db.query(Proposal)

    if status:
        query = query.filter(Proposal.status == status.value)
    if agent_id:
        query = query.filter(Proposal.agent_id == agent_id)

    proposals = query.order_by(Proposal.created_at.desc()).offset(offset).limit(limit).all()
    return proposals


# ── GET /proposals/{id} — Get a single proposal ──────────────
@router.get("/{proposal_id}", response_model=ProposalResponse)
def get_proposal(proposal_id: UUID, db: Session = Depends(get_db)):
    """Retrieve a specific proposal by ID."""
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(404, "Proposal not found")
    return proposal


# ── PUT /proposals/{id}/decide — Human approves or rejects ────
@router.put("/{proposal_id}/decide", response_model=ProposalResponse)
def human_decide(proposal_id: UUID, body: HumanDecision, db: Session = Depends(get_db)):
    """
    Accept a human approval or rejection for a pending proposal.

    Only proposals in PENDING_HUMAN_APPROVAL status can be decided.
    """
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(404, "Proposal not found")

    if proposal.status != ProposalStatus.PENDING_HUMAN_APPROVAL:
        raise HTTPException(
            409,
            f"Proposal is in '{proposal.status.value}' state — "
            f"only PENDING_HUMAN_APPROVAL proposals can be decided",
        )

    now = datetime.now(timezone.utc)
    if body.decision == "APPROVED":
        proposal.status = ProposalStatus.HUMAN_APPROVED
    else:
        proposal.status = ProposalStatus.HUMAN_REJECTED

    proposal.human_decision = {
        "decision": body.decision,
        "reviewer_email": body.reviewer_email,
        "reason": body.reason,
        "decided_at": now.isoformat(),
    }
    proposal.decided_at = now

    # Audit: record human decision
    record_event(db, "HUMAN_DECISION", body.reviewer_email, {
        "decision": body.decision,
        "reason": body.reason,
        "proposal_tool": proposal.tool_id,
    }, proposal_id=proposal.id)

    db.commit()
    db.refresh(proposal)

    logger.info(f"Proposal {proposal.id} {body.decision} by {body.reviewer_email}")
    return proposal


# ── GET /proposals/pending — Shortcut for Governance UI ───────
@router.get("/queue/pending", response_model=list[ProposalResponse])
@router.get("/queue/pending/", response_model=list[ProposalResponse], include_in_schema=False)
@router.get("/pending", response_model=list[ProposalResponse], include_in_schema=False)
@router.get("/pending/", response_model=list[ProposalResponse], include_in_schema=False)
def get_pending_approvals(
    db: Session = Depends(get_db)
):
    """Get all proposals waiting for human approval."""

    proposals = (
        db.query(Proposal)
        .filter(
            Proposal.status
            == ProposalStatus.PENDING_HUMAN_APPROVAL
        )
        .order_by(
            Proposal.created_at.asc()
        )
        .all()
    )

    return proposals


# ── POST /proposals/{id}/execute — Trigger tool execution ─────
from fastapi import BackgroundTasks
import httpx
from control_plane.config import settings

@router.post("/{proposal_id}/execute", response_model=ProposalResponse)
def execute_proposal(
    proposal_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Execute an approved proposal via the Tool Gateway.
    Only proposals in HUMAN_APPROVED or POLICY_APPROVED can be executed.
    """
    proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(404, "Proposal not found")

    allowed_statuses = {
        ProposalStatus.HUMAN_APPROVED,
        ProposalStatus.POLICY_APPROVED,
    }
    if proposal.status not in allowed_statuses:
        raise HTTPException(
            409,
            f"Proposal is in '{proposal.status.value}' state — "
            f"only HUMAN_APPROVED or POLICY_APPROVED proposals can be executed",
        )

    # Transition to EXECUTING
    proposal.status = ProposalStatus.EXECUTING
    record_event(db, "EXECUTION_STARTED", "system", {
        "tool_id": proposal.tool_id,
        "input_payload": proposal.input_payload,
    }, proposal_id=proposal.id)
    db.commit()
    db.refresh(proposal)

    # Dispatch to Tool Gateway in background
    background_tasks.add_task(
        _run_tool_execution,
        proposal_id=proposal.id,
        tool_id=proposal.tool_id,
        input_payload=proposal.input_payload,
    )

    logger.info(f"Proposal {proposal.id} dispatched for execution")
    return proposal


async def _run_tool_execution(
    proposal_id: UUID,
    tool_id: str,
    input_payload: dict,
):
    """Background task: call Tool Gateway and update proposal status."""
    from control_plane.database import SessionLocal

    gateway_url = f"http://127.0.0.1:{settings.MCP_GATEWAY_PORT}"
    timeout = float(settings.MCP_REQUEST_TIMEOUT_SEC)

    endpoint_map = {
        "salesforce_describe_object": "/tools/salesforce/describe",
        "salesforce_query_field_usage": "/tools/salesforce/field-usage",
        "salesforce_health_check": "/health",
    }

    endpoint = endpoint_map.get(tool_id)
    if not endpoint:
        with SessionLocal() as db:
            proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
            if proposal:
                proposal.status = ProposalStatus.FAILED
                proposal.error_message = f"No gateway endpoint mapped for tool: {tool_id}"
                proposal.executed_at = datetime.now(timezone.utc)
                record_event(db, "EXECUTION_FAILED", "system", {
                    "error": proposal.error_message,
                }, proposal_id=proposal.id)
                db.commit()
        return

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{gateway_url}{endpoint}",
                json=input_payload,
            )
            response.raise_for_status()
            result = response.json()

        with SessionLocal() as db:
            proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
            if proposal:
                proposal.status = ProposalStatus.COMPLETED
                proposal.execution_result = result
                proposal.executed_at = datetime.now(timezone.utc)
                record_event(db, "TOOL_EXECUTED", "system", {
                    "tool_id": tool_id,
                    "result_summary": str(result)[:500],
                }, proposal_id=proposal.id)
                db.commit()

    except Exception as exc:
        with SessionLocal() as db:
            proposal = db.query(Proposal).filter(Proposal.id == proposal_id).first()
            if proposal:
                proposal.status = ProposalStatus.FAILED
                proposal.error_message = str(exc)
                proposal.executed_at = datetime.now(timezone.utc)
                record_event(db, "EXECUTION_FAILED", "system", {
                    "error": str(exc),
                }, proposal_id=proposal.id)
                db.commit()


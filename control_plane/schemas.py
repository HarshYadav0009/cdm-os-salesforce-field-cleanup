"""
CDM-OS — Pydantic Schemas (API Request/Response DTOs)

These schemas define the data contract between the Control Plane API
and all clients (Governance UI, Agent Runtime, CLI tools).
"""

from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
from uuid import UUID
from enum import Enum


# ── Enum mirrors ──────────────────────────────────────────────

class ToolTierEnum(str, Enum):
    TIER_1 = "Tier-1"
    TIER_2 = "Tier-2"
    TIER_3 = "Tier-3"


class ProposalStatusEnum(str, Enum):
    PROPOSED = "PROPOSED"
    POLICY_APPROVED = "POLICY_APPROVED"
    POLICY_DENIED = "POLICY_DENIED"
    PENDING_HUMAN_APPROVAL = "PENDING_HUMAN_APPROVAL"
    HUMAN_APPROVED = "HUMAN_APPROVED"
    HUMAN_REJECTED = "HUMAN_REJECTED"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    ROLLED_BACK = "ROLLED_BACK"


# ── Agent Schemas ─────────────────────────────────────────────

class AgentCreate(BaseModel):
    agent_id: str = Field(..., max_length=128, description="Unique agent identifier")
    name: str = Field(..., max_length=256)
    version: str = "1.0.0"
    description: Optional[str] = None
    owner: Optional[str] = None
    model_primary: str = "anthropic/claude-3-5-sonnet-20241022"
    model_fallback: Optional[str] = None
    config_yaml: Optional[str] = None


class AgentResponse(BaseModel):
    id: UUID
    agent_id: str
    name: str
    version: str
    description: Optional[str]
    owner: Optional[str]
    model_primary: str
    model_fallback: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Proposal Schemas ──────────────────────────────────────────

class ProposalCreate(BaseModel):
    """Submitted by the Agent Runtime when it wants to call a tool."""
    agent_id: str = Field(..., description="Which agent is proposing this action")
    tool_id: str = Field(..., description="Which tool to call")
    input_payload: dict = Field(..., description="Tool call arguments")


class ProposalResponse(BaseModel):
    id: UUID
    agent_id: str
    tool_id: str
    status: ProposalStatusEnum
    tier: ToolTierEnum
    input_payload: dict
    policy_result: Optional[dict] = None
    human_decision: Optional[dict] = None
    execution_result: Optional[dict] = None
    error_message: Optional[str] = None
    created_at: datetime
    decided_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class HumanDecision(BaseModel):
    """Submitted by the Governance UI when a human approves or rejects."""
    decision: str = Field(..., pattern="^(APPROVED|REJECTED)$")
    reviewer_email: str
    reason: Optional[str] = None


# ── Tool Schemas ──────────────────────────────────────────────

class ToolResponse(BaseModel):
    id: UUID
    tool_id: str
    name: str
    description: Optional[str]
    tier: ToolTierEnum
    mcp_server: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Audit Log Schemas ─────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: UUID
    event_type: str
    actor: str
    proposal_id: Optional[UUID]
    payload: dict
    hmac_signature: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Policy Evaluation Result ─────────────────────────────────

class PolicyEvalResult(BaseModel):
    """Output of the Policy Engine evaluation."""
    allowed: bool
    requires_human_approval: bool = False
    matched_rules: list[str] = Field(default_factory=list)
    denial_reasons: list[str] = Field(default_factory=list)
    tier: ToolTierEnum


# ── Health Check ──────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    environment: str
    database: str = "connected"
    redis: str = "connected"
    version: str = "0.1.0"

"""
CDM-OS — SQLAlchemy ORM Models

Maps directly to the tables defined in control-plane/database/init.sql.
These models are used by the Control Plane API, Policy Engine, and Agent Runtime.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Text, Boolean, ForeignKey, DateTime, Enum, Index
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import enum

from control_plane.database import Base


# ── Python Enums (mirror SQL ENUMs) ──────────────────────────

class ToolTier(str, enum.Enum):
    TIER_1 = "Tier-1"
    TIER_2 = "Tier-2"
    TIER_3 = "Tier-3"


class ProposalStatus(str, enum.Enum):
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


class AgentStatus(str, enum.Enum):
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    ERROR = "ERROR"
    TERMINATED = "TERMINATED"


# ── ORM Models ────────────────────────────────────────────────

class Agent(Base):
    """Registered agent definition."""
    __tablename__ = "agents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(String(128), unique=True, nullable=False, index=True)
    name = Column(String(256), nullable=False)
    version = Column(String(32), nullable=False, default="1.0.0")
    description = Column(Text)
    owner = Column(String(256))
    model_primary = Column(String(128), nullable=False, default="anthropic/claude-3-5-sonnet-20241022")
    model_fallback = Column(String(128))
    status = Column(
        Enum(AgentStatus, name="agent_status", create_type=False),
        nullable=False,
        default=AgentStatus.IDLE,
    )
    config_yaml = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    proposals = relationship("Proposal", back_populates="agent", lazy="dynamic")

    def __repr__(self):
        return f"<Agent {self.agent_id} [{self.status.value}]>"


class ToolDefinition(Base):
    """Registered tool and its permission tier."""
    __tablename__ = "tool_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tool_id = Column(String(128), unique=True, nullable=False, index=True)
    name = Column(String(256), nullable=False)
    description = Column(Text)
    tier = Column(
        Enum(ToolTier, name="tool_tier", create_type=False),
        nullable=False,
        default=ToolTier.TIER_1,
    )
    mcp_server = Column(String(128))
    schema_json = Column(JSONB)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<Tool {self.tool_id} [{self.tier.value}]>"


class Proposal(Base):
    """An agent's proposed tool call — the core CDM-OS entity."""
    __tablename__ = "proposals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(String(128), ForeignKey("agents.agent_id"), nullable=False)
    tool_id = Column(String(128), ForeignKey("tool_definitions.tool_id"), nullable=False)
    status = Column(
        Enum(ProposalStatus, name="proposal_status", create_type=False),
        nullable=False,
        default=ProposalStatus.PROPOSED,
    )
    tier = Column(Enum(ToolTier, name="tool_tier", create_type=False), nullable=False)
    input_payload = Column(JSONB, nullable=False)
    policy_result = Column(JSONB)
    human_decision = Column(JSONB)
    execution_result = Column(JSONB)
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    decided_at = Column(DateTime(timezone=True))
    executed_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    agent = relationship("Agent", back_populates="proposals")
    tool = relationship("ToolDefinition")
    audit_entries = relationship("AuditLog", back_populates="proposal", lazy="dynamic")

    def __repr__(self):
        return f"<Proposal {self.id} tool={self.tool_id} status={self.status.value}>"


class AuditLog(Base):
    """Immutable, HMAC-signed event log entry."""
    __tablename__ = "audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(64), nullable=False, index=True)
    actor = Column(String(128), nullable=False)
    proposal_id = Column(UUID(as_uuid=True), ForeignKey("proposals.id"))
    payload = Column(JSONB, nullable=False)
    hmac_signature = Column(String(128))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    proposal = relationship("Proposal", back_populates="audit_entries")

    def __repr__(self):
        return f"<AuditLog {self.event_type} at {self.created_at}>"


class PolicyRule(Base):
    """Policy rule loaded from YAML definitions."""
    __tablename__ = "policy_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_id = Column(String(128), unique=True, nullable=False, index=True)
    policy_file = Column(String(256), nullable=False)
    action = Column(String(128), nullable=False)
    tier = Column(Enum(ToolTier, name="tool_tier", create_type=False))
    conditions = Column(JSONB, nullable=False)
    enforcement = Column(JSONB)
    is_active = Column(Boolean, nullable=False, default=True)
    loaded_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<PolicyRule {self.rule_id} active={self.is_active}>"

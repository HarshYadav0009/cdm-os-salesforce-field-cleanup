import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from control_plane.database import Base
from control_plane.models import Agent, Proposal, ProposalStatus, ToolDefinition, ToolTier
from control_plane.policy_engine import PolicyDecision
from control_plane.routes import proposals as proposal_routes
from control_plane.schemas import ProposalCreate


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine)
    session = session_factory()
    session.add(
        Agent(
            agent_id="field-cleanup-agent",
            name="Field Cleanup Agent",
            version="1.0.0",
            model_primary="test-model",
        )
    )
    session.add(
        ToolDefinition(
            tool_id="salesforce_delete_field",
            name="Delete Salesforce Field",
            tier=ToolTier.TIER_3,
        )
    )
    session.commit()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_rejects_duplicate_pending_object_field_proposal(db_session, monkeypatch):
    monkeypatch.setattr(
        proposal_routes.policy_engine,
        "evaluate",
        lambda **_: PolicyDecision(allowed=True, requires_human_approval=True),
    )
    original = ProposalCreate(
        agent_id="field-cleanup-agent",
        tool_id="salesforce_delete_field",
        input_payload={
            "object_name": "Account",
            "field_api_name": "Legacy_Field__c",
        },
    )
    proposal_routes.create_proposal(original, db_session)

    duplicate = ProposalCreate(
        agent_id="field-cleanup-agent",
        tool_id="salesforce_delete_field",
        input_payload={
            "object": "account",
            "field_name": "legacy_field__c",
        },
    )
    with pytest.raises(HTTPException) as error:
        proposal_routes.create_proposal(duplicate, db_session)

    assert error.value.status_code == 409
    assert error.value.detail == "This field is already present in the Approval Queue."
    assert (
        db_session.query(Proposal)
        .filter(Proposal.status == ProposalStatus.PENDING_HUMAN_APPROVAL)
        .count()
        == 1
    )


def test_allows_same_field_for_a_different_object(db_session, monkeypatch):
    monkeypatch.setattr(
        proposal_routes.policy_engine,
        "evaluate",
        lambda **_: PolicyDecision(allowed=True, requires_human_approval=True),
    )
    for object_name in ("Account", "Contact"):
        proposal_routes.create_proposal(
            ProposalCreate(
                agent_id="field-cleanup-agent",
                tool_id="salesforce_delete_field",
                input_payload={
                    "object_name": object_name,
                    "field_api_name": "Legacy_Field__c",
                },
            ),
            db_session,
        )

    assert (
        db_session.query(Proposal)
        .filter(Proposal.status == ProposalStatus.PENDING_HUMAN_APPROVAL)
        .count()
        == 2
    )

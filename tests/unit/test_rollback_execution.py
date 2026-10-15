import asyncio

import pytest
from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from control_plane import database
from control_plane.models import Agent, Proposal, ProposalStatus, ToolDefinition, ToolTier
from control_plane.routes import proposals
from control_plane.schemas import ProposalCreate
from servers.salesforce.validators import validate_tool_payload


@pytest.fixture
def rollback_db(monkeypatch):
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    database.Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine)
    monkeypatch.setattr(database, "SessionLocal", sessions)
    with sessions() as db:
        db.add(Agent(agent_id="field-cleanup-agent", name="Test", version="1", model_primary="test"))
        db.add(ToolDefinition(tool_id="salesforce_rollback_field", name="Restore Description", tier=ToolTier.TIER_2))
        db.commit()
        yield db
    engine.dispose()


@pytest.mark.parametrize("gateway_success", [True, False])
def test_restore_is_dispatched_and_result_recorded(rollback_db, monkeypatch, gateway_success):
    payload = {"backup_id": "bak_Account_Legacy__c_123456789abc", "reason": "Undo deprecation"}
    proposal = proposals.create_proposal(ProposalCreate(agent_id="field-cleanup-agent", tool_id="salesforce_rollback_field", input_payload=payload), rollback_db)
    assert proposal.status == ProposalStatus.POLICY_APPROVED
    background = BackgroundTasks()
    proposals.execute_proposal(proposal.id, background, rollback_db)
    assert proposal.status == ProposalStatus.EXECUTING

    calls = []

    class Client:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, url, json):
            calls.append((url, json))
            return proposals.httpx.Response(
                200 if gateway_success else 400,
                json={"status": "ROLLED_BACK", "restored_description": "Original description"} if gateway_success else {"detail": "Backup not found"},
            )

    monkeypatch.setattr(proposals.httpx, "AsyncClient", Client)
    asyncio.run(background())
    rollback_db.expire_all()
    saved = rollback_db.get(Proposal, proposal.id)
    assert calls == [(f"{proposals.settings.MCP_GATEWAY_URL.rstrip('/')}/tools/salesforce/rollback", payload)]
    if gateway_success:
        assert saved.status == ProposalStatus.COMPLETED
        assert saved.execution_result["restored_description"] == "Original description"
    else:
        assert saved.status == ProposalStatus.FAILED
        assert "Backup not found" in saved.error_message


def test_unapproved_restore_cannot_execute(rollback_db):
    proposal = Proposal(agent_id="field-cleanup-agent", tool_id="salesforce_rollback_field", tier=ToolTier.TIER_2, input_payload={"backup_id": "example"}, status=ProposalStatus.PENDING_HUMAN_APPROVAL)
    rollback_db.add(proposal)
    rollback_db.commit()
    background = BackgroundTasks()
    with pytest.raises(HTTPException) as error:
        proposals.execute_proposal(proposal.id, background, rollback_db)
    assert error.value.status_code == 409
    assert background.tasks == []


@pytest.mark.parametrize("backup_id", [None, "", "../secret", "/tmp/file", "a" * 201])
def test_restore_rejects_missing_or_unsafe_backup_ids(rollback_db, backup_id):
    body = ProposalCreate(agent_id="field-cleanup-agent", tool_id="salesforce_rollback_field", input_payload={"backup_id": backup_id})
    with pytest.raises(HTTPException) as error:
        proposals.create_proposal(body, rollback_db)
    assert error.value.status_code == 400
    assert rollback_db.query(Proposal).count() == 0
    with pytest.raises(ValueError):
        validate_tool_payload("salesforce_rollback_field", {"backup_id": backup_id})


def test_full_assessment_uses_longer_timeout_and_reports_timeout_error(rollback_db, monkeypatch):
    rollback_db.add(ToolDefinition(tool_id="salesforce_full_field_assessment", name="Assess field", tier=ToolTier.TIER_1))
    rollback_db.commit()
    proposal = proposals.create_proposal(ProposalCreate(agent_id="field-cleanup-agent", tool_id="salesforce_full_field_assessment", input_payload={"object_name": "Account", "field_name": "Id"}), rollback_db)
    background = BackgroundTasks()
    proposals.execute_proposal(proposal.id, background, rollback_db)

    class Client:
        def __init__(self, **kwargs):
            assert kwargs["timeout"] == proposals.settings.FIELD_ASSESSMENT_TIMEOUT_SEC

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, *args, **kwargs):
            raise proposals.httpx.ReadTimeout("")

    monkeypatch.setattr(proposals.httpx, "AsyncClient", Client)
    asyncio.run(background())
    rollback_db.expire_all()
    saved = rollback_db.get(Proposal, proposal.id)
    assert saved.status == ProposalStatus.FAILED
    assert "timed out after" in saved.error_message
    assert "salesforce_full_field_assessment" in saved.error_message

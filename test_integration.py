"""
CDM-OS — End-to-End Integration Verification Script
Tests Control Plane ↔ Policy Engine ↔ Audit Log ↔ Tool Gateway integration.
"""

import sys
import os

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, "tool-gateway"))

# Set environment to dev / test
os.environ["CDM_ENV"] = "testing"
os.environ["POLICY_DEFINITIONS_PATH"] = "policy/definitions"

import json
import logging
from uuid import uuid4


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cdm.integration_test")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from control_plane.main import app
from control_plane.database import Base, get_db
from control_plane.models import Agent, ToolDefinition, Proposal, AuditLog, ToolTier, ProposalStatus
from control_plane.policy_engine import policy_engine
from proposals.field_cleanup import FieldCleanupProposalBuilder


from sqlalchemy.pool import StaticPool

# Shared SQLite in-memory engine across threads
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

def run_integration_test():
    logger.info("=" * 70)
    logger.info("Starting CDM-OS Integration & Salesforce Tool Gateway Test")
    logger.info("=" * 70)

    # 1. Create DB tables
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # 2. Seed default agent and tools
    logger.info("1. Seeding agent and tool definitions into DB...")
    agent = Agent(
        agent_id="field-cleanup-agent",
        name="Salesforce Field Cleanup Agent",
        version="1.0.0",
        model_primary="gemini-3.6-flash",
    )
    db.add(agent)

    tool_describe = ToolDefinition(
        tool_id="salesforce_describe_object",
        name="Describe SObject",
        description="Get field metadata",
        tier=ToolTier.TIER_1,
        mcp_server="salesforce-mcp",
    )
    tool_usage = ToolDefinition(
        tool_id="salesforce_query_field_usage",
        name="Query Field Usage",
        description="Compute field population % over time",
        tier=ToolTier.TIER_1,
        mcp_server="salesforce-mcp",
    )
    tool_delete = ToolDefinition(
        tool_id="salesforce_delete_field",
        name="Delete Custom Field",
        description="Permanently delete custom field",
        tier=ToolTier.TIER_3,
        mcp_server="salesforce-mcp",
    )
    db.add_all([tool_describe, tool_usage, tool_delete])
    db.commit()

    # 3. Load Policy Engine
    logger.info("2. Initializing Policy Engine rules...")
    rules_count = policy_engine.load_policies()
    logger.info(f"Loaded {rules_count} policy rules from disk.")

    client = TestClient(app)

    # 4. Verify System Health
    health_resp = client.get("/health")
    logger.info(f"Health Check Status: {health_resp.status_code} -> {health_resp.json()}")
    assert health_resp.status_code == 200

    # 5. Build Proposal using ProposalBuilder
    logger.info("3. Constructing Field Cleanup Proposal...")
    builder = FieldCleanupProposalBuilder()
    mock_usage = {
        "object": "Account",
        "field": "Legacy_Id__c",
        "total_records": 1500,
        "populated_records": 0,
        "usage_percentage": 0.0,
        "zero_usage_candidate": True,
    }
    mock_meta = {
        "fields": [
            {
                "name": "Legacy_Id__c",
                "label": "Legacy ID",
                "type": "string",
                "custom": True,
            }
        ]
    }
    proposal_payload = builder.build(mock_usage, mock_meta)
    logger.info(f"Built Proposal Payload:\n{json.dumps(proposal_payload, indent=2)}")

    # 6. Submit Proposal to Control Plane
    logger.info("4. Submitting Proposal to Control Plane API (POST /api/v1/proposals/)...")
    res = client.post("/api/v1/proposals/", json=proposal_payload)
    assert res.status_code == 201, f"Proposal creation failed: {res.text}"
    prop_data = res.json()
    logger.info(f"Proposal Response: ID={prop_data['id']} | Status={prop_data['status']}")

    # 7. Test Tier-3 Proposal (Requires Human Approval)
    logger.info("5. Testing Tier-3 Proposal submission (salesforce_delete_field)...")
    tier3_payload = {
        "agent_id": "field-cleanup-agent",
        "tool_id": "salesforce_delete_field",
        "input_payload": {
            "field_api_name": "Legacy_Id__c",
            "object_api_name": "Account",
        },
    }
    t3_res = client.post("/api/v1/proposals/", json=tier3_payload)
    assert t3_res.status_code == 201
    t3_data = t3_res.json()
    logger.info(f"Tier-3 Proposal Response: Status={t3_data['status']} (Expected: PENDING_HUMAN_APPROVAL)")
    assert t3_data["status"] == "PENDING_HUMAN_APPROVAL"

    # 8. Human Approves Tier-3 Proposal
    logger.info("6. Simulating Human Decision (PUT /api/v1/proposals/{id}/decide)...")
    decide_payload = {
        "decision": "APPROVED",
        "reviewer_email": "admin@enterprise.com",
        "reason": "Verified zero usage across last 90 days",
    }
    dec_res = client.put(f"/api/v1/proposals/{t3_data['id']}/decide", json=decide_payload)
    assert dec_res.status_code == 200
    dec_data = dec_res.json()
    logger.info(f"Human Decision Output: Status={dec_data['status']} (Expected: HUMAN_APPROVED)")
    assert dec_data["status"] == "HUMAN_APPROVED"

    # 9. Verify Audit Trail Records & HMAC Signatures
    logger.info("7. Verifying Audit Trail and HMAC Signatures...")
    audit_events = db.query(AuditLog).order_by(AuditLog.created_at.asc()).all()
    logger.info(f"Total Audit Trail Entries Logged: {len(audit_events)}")
    for ev in audit_events:
        logger.info(f"  - Event: {ev.event_type:<20} Actor: {ev.actor:<20} HMAC: {ev.hmac_signature[:16]}...")
        assert ev.hmac_signature is not None

    logger.info("=" * 70)
    logger.info("✅ INTEGRATION TEST PASSED! All core components connected successfully.")
    logger.info("=" * 70)

if __name__ == "__main__":
    run_integration_test()

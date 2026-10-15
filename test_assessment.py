"""
CDM-OS — Test Assessment & Reference Scanner Integration Script
Simulates full 3-phase field safety report creation, proposal submission,
policy evaluation, human approval, and audit trail generation.
"""

import sys
import os

project_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_root)
sys.path.insert(0, os.path.join(project_root, "tool-gateway"))

os.environ["CDM_ENV"] = "testing"
os.environ["POLICY_DEFINITIONS_PATH"] = "policy/definitions"

import json
import logging
from unittest.mock import MagicMock

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cdm.test_assessment")

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from control_plane.main import app
from control_plane.database import Base, get_db
from control_plane.models import Agent, ToolDefinition, ToolTier, ProposalStatus, AuditLog
from control_plane.policy_engine import policy_engine
from proposals.field_cleanup import FieldCleanupProposalBuilder
from servers.salesforce.field_assessment import FieldAssessmentService, RISK_SAFE, RISK_BLOCKED, RISK_REVIEW


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


def run_assessment_test():
    logger.info("=" * 70)
    logger.info("Starting CDM-OS 3-Phase Assessment & Reference Scan Test")
    logger.info("=" * 70)

    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Seed Agent & Tools
    agent = Agent(
        agent_id="field-cleanup-agent",
        name="Salesforce Field Cleanup Agent",
        version="1.0.0",
        model_primary="gemini-3.6-flash",
    )
    db.add(agent)

    tool_assessment = ToolDefinition(
        tool_id="salesforce_full_field_assessment",
        name="Full Field Safety Assessment",
        description="Run 3-phase metadata, population, and reference scan report",
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
    db.add_all([tool_assessment, tool_delete])
    db.commit()

    policy_engine.load_policies()

    # Mock Salesforce Client for assessment runner test
    mock_sf_client = MagicMock()
    mock_sf_client.describe.return_value = {
        "name": "Account",
        "label": "Account",
        "custom": False,
        "fields": [
            {
                "name": "Unused_Legacy_Field__c",
                "label": "Unused Legacy Field",
                "type": "string",
                "length": 255,
                "custom": True,
                "nillable": True,
                "createable": True,
                "updateable": True,
                "trackHistory": False,
            }
        ],
    }
    mock_sf_client.query.side_effect = [
        {"records": [{"total": 1200}]},      # get_total_records
        {"records": [{"populated": 0}]},      # get_populated_records
    ]
    # Tooling query mocks for Apex/Flow/Validation/Layout scans
    mock_sf_client.tooling_query.side_effect = [
        {"records": []}, # ApexClass
        {"records": []}, # ApexTrigger
        {"records": []}, # Flow
        {"records": []}, # LightningComponentResource
        {"records": []}, # ValidationRule
        {"records": []}, # MetadataComponentDependency Layouts
    ]

    logger.info("1. Executing Full Field Assessment Service (Mocked SF Client)...")
    svc = FieldAssessmentService(client=mock_sf_client)
    report = svc.run("Account", "Unused_Legacy_Field__c")

    logger.info(f"Generated Risk Report Level: {report['risk_level']}")
    logger.info(f"Assessment Summary:\n  {report['assessment_summary']}")
    assert report["risk_level"] == RISK_SAFE
    assert report["data_usage"]["usage_percentage"] == 0.0
    assert report["reference_scan"]["total_metadata_references"] == 0

    logger.info("2. Constructing Control Plane Proposal Payload...")
    builder = FieldCleanupProposalBuilder()
    proposal_payload = builder.build_from_assessment(report)

    client = TestClient(app)
    logger.info("3. Submitting Assessment Proposal to Control Plane...")
    res = client.post("/api/v1/proposals/", json=proposal_payload)
    assert res.status_code == 201
    prop_data = res.json()
    logger.info(f"Proposal Created: ID={prop_data['id']} | Status={prop_data['status']}")
    assert prop_data["status"] == "POLICY_APPROVED"

    # Test BLOCKED field scenario (field referenced in Apex Class)
    logger.info("4. Testing Risk Blocked Scenario (Field referenced in Apex Class)...")
    mock_sf_client_blocked = MagicMock()
    mock_sf_client_blocked.describe.return_value = mock_sf_client.describe.return_value
    mock_sf_client_blocked.query.side_effect = [
        {"records": [{"total": 1200}]},
        {"records": [{"populated": 0}]},
    ]
    mock_sf_client_blocked.tooling_query.side_effect = [
        {
            "records": [
                {
                    "Name": "AccountServiceController",
                    "Body": "public class AccountServiceController { void sync() { String id = acc.Unused_Legacy_Field__c; } }",
                }
            ]
        }, # ApexClass hit!
        {"records": []}, # ApexTrigger
        {"records": []}, # Flow
        {"records": []}, # LightningComponentResource
        {"records": []}, # ValidationRule
        {"records": []}, # Layout
    ]

    svc_blocked = FieldAssessmentService(client=mock_sf_client_blocked)
    blocked_report = svc_blocked.run("Account", "Unused_Legacy_Field__c")

    logger.info(f"Blocked Field Risk Level: {blocked_report['risk_level']}")
    logger.info(f"Blocked Field Summary:\n  {blocked_report['assessment_summary']}")
    assert blocked_report["risk_level"] == RISK_BLOCKED
    assert len(blocked_report["impact_summary"]["apex_classes_affected"]) == 1
    assert blocked_report["impact_summary"]["apex_classes_affected"][0] == "AccountServiceController"

    logger.info("=" * 70)
    logger.info("✅ ASSESSMENT INTEGRATION TEST PASSED SUCCESSFULLY!")
    logger.info("=" * 70)

if __name__ == "__main__":
    run_assessment_test()

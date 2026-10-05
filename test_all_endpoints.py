"""
CDM-OS — Comprehensive End-to-End API Endpoint Tester
Tests every Control Plane (Port 8000) and Tool Gateway (Port 8080) endpoint individually.
"""

import sys
import json
import httpx
import uuid

CONTROL_PLANE_URL = "http://localhost:8000"
TOOL_GATEWAY_URL = "http://localhost:8080"


def print_section(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def test_endpoint(name: str, method: str, url: str, json_data: dict = None, expected_status: int = 200):
    print(f"\n[TEST] {name}")
    print(f"  Request  : {method.upper()} {url}")
    
    try:
        with httpx.Client(timeout=10.0) as client:
            if method.upper() == "GET":
                res = client.get(url)
            elif method.upper() == "POST":
                res = client.post(url, json=json_data)
            elif method.upper() == "PUT":
                res = client.put(url, json=json_data)
            elif method.upper() == "PATCH":
                res = client.patch(url)
            else:
                raise ValueError(f"Unsupported method {method}")

        print(f"  Status   : {res.status_code} (Expected {expected_status})")
        if res.status_code == expected_status:
            print("  Result   : [OK] SUCCESS")
            try:
                data = res.json()
                summary = json.dumps(data, indent=2)[:300]
                if len(json.dumps(data)) > 300:
                    summary += "\n  ... [truncated]"
                print(f"  Response :\n{summary}")
                return data
            except Exception:
                print(f"  Response : {res.text}")
                return res.text
        else:
            print(f"  Result   : [FAIL] FAILED — {res.text}")
            return None

    except Exception as exc:
        print(f"  Result   : [ERROR] ERROR — {exc}")
        return None


def run_all_tests():
    print_section("1. SYSTEM & HEALTH CHECK ENDPOINTS")
    test_endpoint("Control Plane Health Check", "GET", f"{CONTROL_PLANE_URL}/health")
    test_endpoint("Control Plane Root Endpoint", "GET", f"{CONTROL_PLANE_URL}/")
    test_endpoint("Tool Gateway Health Check", "GET", f"{TOOL_GATEWAY_URL}/health")

    print_section("2. AGENTS API ENDPOINTS (/api/v1/agents)")
    
    # 2a. Register field-cleanup-agent
    cleanup_agent_payload = {
        "agent_id": "field-cleanup-agent",
        "name": "Salesforce Field Cleanup Agent",
        "version": "1.0.0",
        "description": "Primary cleanup agent",
        "owner": "admin@enterprise.com",
        "model_primary": "gemini-3.6-flash"
    }
    test_endpoint("Register Primary Cleanup Agent", "POST", f"{CONTROL_PLANE_URL}/api/v1/agents/", json_data=cleanup_agent_payload, expected_status=201)

    # 2b. Register secondary test agent
    test_agent_id = f"test-agent-{uuid.uuid4().hex[:6]}"
    agent_payload = {
        "agent_id": test_agent_id,
        "name": "Automated Test Agent",
        "version": "1.0.0",
        "description": "Agent created by test_all_endpoints script",
        "owner": "qa-team@enterprise.com",
        "model_primary": "gemini-3.6-flash"
    }
    test_endpoint("Register Secondary Test Agent", "POST", f"{CONTROL_PLANE_URL}/api/v1/agents/", json_data=agent_payload, expected_status=201)
    
    # GET /agents/
    test_endpoint("List Registered Agents", "GET", f"{CONTROL_PLANE_URL}/api/v1/agents/")
    
    # GET /agents/{id}
    test_endpoint("Get Single Agent Details", "GET", f"{CONTROL_PLANE_URL}/api/v1/agents/{test_agent_id}")
    
    # PATCH /agents/{id}/status
    test_endpoint("Update Agent Status to RUNNING", "PATCH", f"{CONTROL_PLANE_URL}/api/v1/agents/{test_agent_id}/status?status=RUNNING")

    print_section("3. TOOLS API ENDPOINTS (/api/v1/tools)")
    test_endpoint("List Registered Tools and Tiers", "GET", f"{CONTROL_PLANE_URL}/api/v1/tools/")

    print_section("4. PROPOSALS API ENDPOINTS (/api/v1/proposals)")
    
    # Create Tier-1 (auto-approved) proposal
    tier1_proposal_payload = {
        "agent_id": "field-cleanup-agent",
        "tool_id": "salesforce_describe_object",
        "input_payload": {
            "object_api_name": "Account",
            "field_api_name": "Unused_Legacy_Field__c"
        }
    }
    test_endpoint("Create Tier-1 Proposal (Auto-Approved)", "POST", f"{CONTROL_PLANE_URL}/api/v1/proposals/", json_data=tier1_proposal_payload, expected_status=201)

    # Create Tier-3 (Pending Human Approval) proposal
    tier3_proposal_payload = {
        "agent_id": "field-cleanup-agent",
        "tool_id": "salesforce_delete_field",
        "input_payload": {
            "object_api_name": "Account",
            "field_api_name": "Obsolete_Column__c"
        }
    }
    prop_tier3 = test_endpoint("Create Tier-3 Proposal (Needs Human Approval)", "POST", f"{CONTROL_PLANE_URL}/api/v1/proposals/", json_data=tier3_proposal_payload, expected_status=201)

    # GET /proposals/
    test_endpoint("List All Proposals", "GET", f"{CONTROL_PLANE_URL}/api/v1/proposals/")

    # GET /proposals/queue/pending
    test_endpoint("Get Pending Approvals Queue", "GET", f"{CONTROL_PLANE_URL}/api/v1/proposals/queue/pending")

    proposal_id = prop_tier3.get("id") if prop_tier3 else None
    if proposal_id:
        # GET /proposals/{id}
        test_endpoint("Get Single Proposal", "GET", f"{CONTROL_PLANE_URL}/api/v1/proposals/{proposal_id}")

        # PUT /proposals/{id}/decide
        decide_payload = {
            "decision": "APPROVED",
            "reviewer_email": "lead-admin@enterprise.com",
            "reason": "Verified zero record population over 90 days"
        }
        test_endpoint("Approve Proposal (Human Decision)", "PUT", f"{CONTROL_PLANE_URL}/api/v1/proposals/{proposal_id}/decide", json_data=decide_payload)

        # POST /proposals/{id}/execute
        test_endpoint("Execute Approved Proposal", "POST", f"{CONTROL_PLANE_URL}/api/v1/proposals/{proposal_id}/execute")

    print_section("5. AUDIT LOG API ENDPOINTS (/api/v1/audit)")
    test_endpoint("List All Audit Trail Log Entries", "GET", f"{CONTROL_PLANE_URL}/api/v1/audit/")
    test_endpoint("List Filtered Audit Logs (HUMAN_DECISION)", "GET", f"{CONTROL_PLANE_URL}/api/v1/audit/?event_type=HUMAN_DECISION")

    print_section("6. TOOL GATEWAY ENDPOINTS (Port 8080)")
    test_endpoint("List Tool Gateway Definitions", "GET", f"{TOOL_GATEWAY_URL}/tools")
    
    describe_payload = {"object_name": "Account"}
    test_endpoint("Describe Salesforce Object Metadata", "POST", f"{TOOL_GATEWAY_URL}/tools/salesforce/describe", json_data=describe_payload)

    usage_payload = {"object_name": "Account", "field_name": "Industry"}
    test_endpoint("Query Salesforce Field Usage", "POST", f"{TOOL_GATEWAY_URL}/tools/salesforce/field-usage", json_data=usage_payload)

    scan_payload = {"object_name": "Account", "field_name": "Industry"}
    test_endpoint("Scan Code References for Field", "POST", f"{TOOL_GATEWAY_URL}/tools/salesforce/scan-references", json_data=scan_payload)

    full_payload = {"object_name": "Account", "field_name": "Industry"}
    test_endpoint("Run Full 3-Phase Assessment", "POST", f"{TOOL_GATEWAY_URL}/tools/salesforce/full-assessment", json_data=full_payload)

    print_section("[OK] ALL ENDPOINT TESTS COMPLETED!")


if __name__ == "__main__":
    run_all_tests()

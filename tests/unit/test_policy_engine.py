"""
CDM-OS Control Plane — Policy Engine Unit Tests
"""

import pytest
from control_plane.policy_engine import PolicyEngine
from control_plane.models import ToolTier


@pytest.fixture
def policy_engine():
    engine = PolicyEngine(definitions_path="policy/definitions")
    count = engine.load_policies()
    assert count > 0, "Expected at least 1 policy file to be loaded from policy/definitions"
    return engine


def test_tier_1_implicit_allow(policy_engine):
    """Tier 1 read actions should always be allowed with no HITL."""
    decision = policy_engine.evaluate(
        tool_id="salesforce_describe_object",
        tier=ToolTier.TIER_1,
        input_payload={"object_api_name": "Account"}
    )

    assert decision.allowed is True
    assert decision.requires_human_approval is False
    assert "implicit_tier1_allow" in decision.matched_rules


def test_tier_3_implicit_hitl(policy_engine):
    """Tier 3 actions require HITL approval."""
    decision = policy_engine.evaluate(
        tool_id="salesforce_delete_field",
        tier=ToolTier.TIER_3,
        input_payload={"field_api_name": "Unused_Field__c"}
    )

    assert decision.allowed is True
    assert decision.requires_human_approval is True


def test_standard_field_deletion_denial(policy_engine):
    """Deleting a non-custom field (e.g. AccountNumber) should be denied by policy rule."""
    decision = policy_engine.evaluate(
        tool_id="salesforce_delete_field",
        tier=ToolTier.TIER_3,
        input_payload={"field_api_name": "AccountNumber"}
    )

    assert decision.allowed is False
    assert len(decision.denial_reasons) > 0
    assert any("deny condition matched" in r for r in decision.denial_reasons)


def test_system_pattern_field_deletion_denial(policy_engine):
    """Deleting a system pattern field (e.g. CreatedDate) should be denied by regex condition."""
    decision = policy_engine.evaluate(
        tool_id="salesforce_delete_field",
        tier=ToolTier.TIER_3,
        input_payload={"field_api_name": "CreatedDate"}
    )

    assert decision.allowed is False
    assert len(decision.denial_reasons) > 0


def test_managed_package_field_deletion_denial(policy_engine):
    """Deleting a managed package field (e.g. namespace__Custom_Field__c) should be denied."""
    decision = policy_engine.evaluate(
        tool_id="salesforce_delete_field",
        tier=ToolTier.TIER_3,
        input_payload={"field_api_name": "appnamespace__Custom_Field__c"}
    )

    assert decision.allowed is False
    assert len(decision.denial_reasons) > 0


def test_valid_custom_field_deletion(policy_engine):
    """Deleting a valid custom field (e.g. Legacy_Rating__c) should be allowed but require HITL."""
    decision = policy_engine.evaluate(
        tool_id="salesforce_delete_field",
        tier=ToolTier.TIER_3,
        input_payload={"field_api_name": "Legacy_Rating__c"}
    )

    assert decision.allowed is True
    assert decision.requires_human_approval is True
    assert len(decision.denial_reasons) == 0


@pytest.mark.parametrize("payload", [
    {"field_name": "Legacy_Rating__c"},
    {"field_api_name": " Legacy_Rating__c "},
    {"field_name": "Legacy_Rating__c", "field_api_name": "Legacy_Rating__c"},
    {"field_name": "Legacy_Rating__c", "field_api_name": ""},
])
def test_deletion_identifier_aliases(policy_engine, payload):
    decision = policy_engine.evaluate("salesforce_delete_field", ToolTier.TIER_3, payload)
    assert decision.allowed is True
    assert decision.requires_human_approval is True


@pytest.mark.parametrize("payload", [
    {"field_name": "Name", "field_api_name": "Legacy_Rating__c"},
    {"field_name": "Legacy_Rating__c", "field_api_name": "Name"},
    {"field_name": "pkg__Field__c", "field_api_name": "Legacy_Rating__c"},
])
def test_conflicting_deletion_identifiers_are_denied(policy_engine, payload):
    decision = policy_engine.evaluate("salesforce_delete_field", ToolTier.TIER_3, payload)
    assert decision.allowed is False
    assert any("Conflicting" in reason for reason in decision.denial_reasons)


@pytest.mark.parametrize("field_name", ["Name", "pkg__Field__c", "pkg__custom__c", "Field__pc", ""])
def test_field_name_alias_preserves_protection(policy_engine, field_name):
    decision = policy_engine.evaluate(
        "salesforce_delete_field", ToolTier.TIER_3, {"field_name": field_name}
    )
    assert decision.allowed is False


@pytest.mark.parametrize("payload", [{}, {"field_name": None}, {"field_api_name": 123}])
def test_missing_or_invalid_identifier_is_denied(policy_engine, payload):
    decision = policy_engine.evaluate("salesforce_delete_field", ToolTier.TIER_3, payload)
    assert decision.allowed is False


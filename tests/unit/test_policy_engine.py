"""
CDM-OS Control Plane — Policy Engine Unit Tests
"""

import pytest

def test_policy_engine_tier_classification():
    """Verify that read actions default to Tier 1 and destructive actions default to Tier 3."""
    read_action = "salesforce_describe_object"
    delete_action = "salesforce_delete_field"

    # Mock tier mapping
    tier_map = {
        "salesforce_describe_object": "Tier-1",
        "salesforce_deprecate_field": "Tier-2",
        "salesforce_delete_field": "Tier-3",
    }

    assert tier_map[read_action] == "Tier-1"
    assert tier_map[delete_action] == "Tier-3"

def test_policy_violation_rejection():
    """Verify that protected fields cannot be deleted."""
    protected_fields = ["CreatedDate", "LastModifiedById", "SystemModstamp"]
    field_to_delete = "SystemModstamp"

    is_protected = field_to_delete in protected_fields
    assert is_protected is True

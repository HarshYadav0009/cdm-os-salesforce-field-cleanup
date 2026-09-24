"""
CDM-OS — Policy Engine

Loads YAML policy definitions from disk, evaluates agent tool call proposals
against the active rule set, and returns ALLOW / DENY / ESCALATE decisions.

This is the core security gatekeeper: no tool call executes without passing
through evaluate_proposal().
"""

import yaml
import logging
from pathlib import Path
from typing import Optional
from dataclasses import dataclass, field

from control_plane.config import settings
from control_plane.models import ToolTier

logger = logging.getLogger("cdm.policy")


# ── Parsed Rule Representation ────────────────────────────────

@dataclass
class ParsedRule:
    """In-memory representation of a single policy rule from YAML."""
    rule_id: str
    action: str  # Tool ID pattern (or "all_tools")
    source_file: str
    conditions: dict = field(default_factory=dict)
    enforcement: dict = field(default_factory=dict)
    tier: Optional[str] = None

    @property
    def requires_hitl(self) -> bool:
        return self.enforcement.get("require_hitl_approval", False)

    @property
    def on_violation(self) -> str:
        return self.enforcement.get("on_violation", self.conditions.get("on_violation", "REJECT"))

    @property
    def max_operations(self) -> Optional[int]:
        return self.conditions.get("max_operations_per_run")


# ── Evaluation Result ─────────────────────────────────────────

@dataclass
class PolicyDecision:
    """The output of evaluating a proposal against the policy engine."""
    allowed: bool
    requires_human_approval: bool = False
    matched_rules: list[str] = field(default_factory=list)
    denial_reasons: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "allowed": self.allowed,
            "requires_human_approval": self.requires_human_approval,
            "matched_rules": self.matched_rules,
            "denial_reasons": self.denial_reasons,
        }


# ── Policy Engine ─────────────────────────────────────────────

class PolicyEngine:
    """
    Loads policy YAML files and evaluates tool-call proposals.

    Usage:
        engine = PolicyEngine()
        engine.load_policies()           # Load all YAML files from policy/definitions/
        decision = engine.evaluate(tool_id, tier, input_payload)
    """

    def __init__(self, definitions_path: Optional[str] = None):
        self.definitions_path = Path(definitions_path or settings.POLICY_DEFINITIONS_PATH)
        self.rules: list[ParsedRule] = []
        self._mode = settings.POLICY_MODE  # enforce | audit_only | dry_run

    def load_policies(self) -> int:
        """
        Load all .yaml files from the definitions directory.
        Returns the number of rules loaded.
        """
        self.rules.clear()

        if not self.definitions_path.exists():
            logger.warning(f"Policy definitions path does not exist: {self.definitions_path}")
            return 0

        for yaml_file in self.definitions_path.glob("*.yaml"):
            try:
                with open(yaml_file, "r") as f:
                    policy_doc = yaml.safe_load(f)

                if not policy_doc or "rules" not in policy_doc:
                    logger.warning(f"Skipping {yaml_file.name}: no 'rules' key found")
                    continue

                for rule_data in policy_doc["rules"]:
                    parsed = ParsedRule(
                        rule_id=rule_data.get("id", f"unnamed_{yaml_file.stem}"),
                        action=rule_data.get("action", "all_tools"),
                        source_file=yaml_file.name,
                        conditions=rule_data.get("condition", {}),
                        enforcement=rule_data.get("enforcement", {}),
                        tier=rule_data.get("tier"),
                    )
                    self.rules.append(parsed)

                logger.info(f"Loaded {len(policy_doc['rules'])} rules from {yaml_file.name}")

            except Exception as e:
                logger.error(f"Failed to parse {yaml_file.name}: {e}")

        logger.info(f"Policy Engine loaded {len(self.rules)} total rules")
        return len(self.rules)

    def evaluate(self, tool_id: str, tier: ToolTier, input_payload: dict) -> PolicyDecision:
        """
        Evaluate a proposed tool call against all loaded policy rules.

        Logic:
        1. Tier-1 tools → always allowed (read-only, no side effects)
        2. Tier-2 tools → allowed but logged as reversible operations
        3. Tier-3 tools → check rules; if any rule requires HITL, escalate
        4. If any rule explicitly denies the action, deny it outright

        Args:
            tool_id: The tool being called
            tier: The tool's permission tier
            input_payload: The tool call arguments

        Returns:
            PolicyDecision with allow/deny/escalate result
        """
        decision = PolicyDecision(allowed=True)

        # ── Tier-1 tools are always allowed ───────────────────
        if tier == ToolTier.TIER_1:
            decision.matched_rules.append("implicit_tier1_allow")
            return decision

        # ── Find applicable rules ─────────────────────────────
        applicable_rules = [
            r for r in self.rules
            if r.action == "all_tools" or r.action == tool_id
        ]

        for rule in applicable_rules:
            decision.matched_rules.append(rule.rule_id)

            # Check for deny conditions (e.g., protected fields)
            deny_conditions = rule.conditions.get("deny_if", [])
            for condition in deny_conditions:
                if self._check_deny_condition(condition, input_payload):
                    decision.allowed = False
                    decision.denial_reasons.append(
                        f"Rule {rule.rule_id}: deny condition matched — {condition}"
                    )

            # Check rate limits
            if rule.max_operations is not None:
                # In a real implementation, we'd query the DB for recent operation count
                # For now, this is a placeholder that always passes
                pass

            # Check HITL requirement
            if rule.requires_hitl:
                decision.requires_human_approval = True

        # ── Tier-3 always requires HITL even without explicit rules ──
        if tier == ToolTier.TIER_3 and not decision.requires_human_approval:
            decision.requires_human_approval = True
            decision.matched_rules.append("implicit_tier3_hitl_requirement")

        # ── Audit-only mode: allow everything but log ─────────
        if self._mode == "audit_only":
            if not decision.allowed:
                logger.warning(
                    f"AUDIT_ONLY: Would have denied {tool_id} — {decision.denial_reasons}"
                )
            decision.allowed = True
            decision.requires_human_approval = False

        # ── Dry-run mode: always deny ─────────────────────────
        if self._mode == "dry_run":
            decision.allowed = False
            decision.denial_reasons.append("Policy mode is dry_run — no executions permitted")

        return decision

    @staticmethod
    def _check_deny_condition(condition: dict, payload: dict) -> bool:
        """
        Evaluate a single deny condition against the tool input payload.

        Supported condition types:
        - is_custom_field: false  → deny if field is not custom (no __c suffix)
        - is_managed_package: true → deny if field belongs to a managed package
        - field_name_matches: <regex> → deny if field name matches pattern
        """
        import re

        field_name = payload.get("field_api_name", "")

        if "is_custom_field" in condition:
            if condition["is_custom_field"] is False and field_name.endswith("__c"):
                return False  # It IS custom, so this deny doesn't apply
            if condition["is_custom_field"] is False and not field_name.endswith("__c"):
                return True  # Not custom → deny

        if "is_managed_package" in condition:
            # Managed package fields have namespace__FieldName__c pattern
            if condition["is_managed_package"] is True and "__" in field_name.split("__c")[0]:
                return True

        if "field_name_matches" in condition:
            pattern = condition["field_name_matches"]
            if re.match(pattern, field_name):
                return True

        return False


# ── Module-level singleton ────────────────────────────────────
policy_engine = PolicyEngine()

import os
import json
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

logger = logging.getLogger("knowledge.precedents")


class PrecedentStore:
    """
    Historical Precedent Memory Store.
    Stores and retrieves human approval/rejection decisions with TTL lifecycle enforcement.
    Prevents repeating previously rejected actions (e.g. attempting to delete a field used in external ETL).
    """

    def __init__(self, storage_dir: Optional[str] = None):
        if storage_dir is None:
            base = os.path.dirname(os.path.abspath(__file__))
            self.storage_dir = os.path.join(base, "data")
        else:
            self.storage_dir = storage_dir

        os.makedirs(self.storage_dir, exist_ok=True)
        self._memory_store: Dict[str, Dict[str, Any]] = {}
        self._load_from_disk()

        # Seed with initial well-known precedent if empty
        if not self._memory_store:
            self.record_precedent(
                object_name="Account",
                field_name="Sync_Status__c",
                decision="REJECTED",
                reason="Field is utilized by external nightly ETL data pipeline not indexed in Tooling API.",
                decided_by="salesforce-lead@company.com",
                ttl_days=180,
                context_tags=["etl", "external_integration", "nightly_sync"]
            )

    def _load_from_disk(self):
        for fname in os.listdir(self.storage_dir):
            if fname.endswith(".json"):
                fpath = os.path.join(self.storage_dir, fname)
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        self._memory_store[data["precedent_id"]] = data
                except Exception as exc:
                    logger.warning(f"Failed to load precedent file {fname}: {exc}")

    def _persist(self, precedent: Dict[str, Any]):
        pid = precedent["precedent_id"]
        fpath = os.path.join(self.storage_dir, f"{pid}.json")
        with open(fpath, "w", encoding="utf-8") as f:
            json.dump(precedent, f, indent=2)

    def record_precedent(
        self,
        object_name: str,
        field_name: str,
        decision: str,  # "APPROVED" or "REJECTED"
        reason: str,
        decided_by: str,
        ttl_days: int = 180,
        context_tags: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Record a human governance decision as a persistent precedent."""
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(days=ttl_days)
        pid = f"PRE-{now.year}-{uuid.uuid4().hex[:8].upper()}"

        precedent = {
            "precedent_id": pid,
            "object_name": object_name,
            "field_name": field_name,
            "decision": decision.upper(),
            "reason": reason,
            "decided_by": decided_by,
            "created_at": now.isoformat(),
            "ttl_days": ttl_days,
            "expires_at": expires_at.isoformat(),
            "status": "ACTIVE",
            "context_tags": context_tags or []
        }

        self._memory_store[pid] = precedent
        self._persist(precedent)
        logger.info(f"Recorded precedent {pid} for {object_name}.{field_name} -> {decision}")
        return precedent

    def get_precedent(self, precedent_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve precedent by ID, updating status if expired."""
        p = self._memory_store.get(precedent_id)
        if not p:
            return None

        # Check TTL expiration
        expires = datetime.fromisoformat(p["expires_at"])
        if datetime.now(timezone.utc) > expires:
            p["status"] = "EXPIRED"
            self._persist(p)

        return p

    def find_precedents(
        self,
        object_name: Optional[str] = None,
        field_name: Optional[str] = None,
        active_only: bool = True
    ) -> List[Dict[str, Any]]:
        """Search precedents matching object and/or field."""
        matches = []
        now = datetime.now(timezone.utc)

        for p in self._memory_store.values():
            expires = datetime.fromisoformat(p["expires_at"])
            if now > expires and p["status"] == "ACTIVE":
                p["status"] = "EXPIRED"
                self._persist(p)

            if active_only and p["status"] != "ACTIVE":
                continue

            if object_name and p.get("object_name", "").lower() != object_name.lower():
                continue

            if field_name and p.get("field_name", "").lower() != field_name.lower():
                continue

            matches.append(p)

        return matches

    def check_applicability(self, object_name: str, field_name: str) -> Dict[str, Any]:
        """
        Check if any active precedents apply to a proposed field cleanup action.
        """
        precedents = self.find_precedents(object_name, field_name, active_only=True)
        if not precedents:
            return {
                "has_precedent": False,
                "precedents": [],
                "recommendation": "No prior precedents found; proceed with standard evaluation."
            }

        rejections = [p for p in precedents if p["decision"] == "REJECTED"]
        if rejections:
            latest = rejections[-1]
            return {
                "has_precedent": True,
                "status": "REJECTION_PRECEDENT_ACTIVE",
                "precedents": precedents,
                "warning": f"Active precedent {latest['precedent_id']} previously rejected remediation: '{latest['reason']}'",
                "recommendation": "HALT_OR_ESCALATE"
            }

        return {
            "has_precedent": True,
            "status": "APPROVAL_PRECEDENT_ACTIVE",
            "precedents": precedents,
            "recommendation": "Prior cleanup was approved for similar criteria."
        }

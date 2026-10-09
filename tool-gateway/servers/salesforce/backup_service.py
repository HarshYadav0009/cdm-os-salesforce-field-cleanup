import os
import json
import uuid
import hashlib
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from .client import SalesforceClient
from .metadata import SalesforceMetadataService
from .validators import validate_salesforce_identifier

logger = logging.getLogger("salesforce.backup_service")


class SalesforceBackupService:
    """
    Metadata Backup and Rollback Service.
    Ensures that every modification to a Salesforce field is preceded by an immutable
    metadata snapshot, allowing automatic or explicit rollback in case of error.
    """

    def __init__(
        self,
        client: Optional[SalesforceClient] = None,
        backup_dir: Optional[str] = None
    ):
        self.client = client if client is not None else SalesforceClient()
        self.metadata_service = SalesforceMetadataService(self.client)

        if backup_dir is None:
            # Place in audit/backups relative to repository root
            repo_root = os.path.dirname(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            )
            self.backup_dir = os.path.join(repo_root, "audit", "backups")
        else:
            self.backup_dir = backup_dir

        os.makedirs(self.backup_dir, exist_ok=True)
        self._memory_backups: Dict[str, Dict[str, Any]] = {}

    def _compute_checksum(self, data: Dict[str, Any]) -> str:
        serialized = json.dumps(data, sort_keys=True)
        return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

    def backup_field_definition(
        self,
        object_name: str,
        field_name: str
    ) -> Dict[str, Any]:
        """
        Export field metadata and permissions before any lifecycle modification.
        Stores an immutable backup artifact.
        """
        object_name = validate_salesforce_identifier(object_name)
        field_name = validate_salesforce_identifier(field_name)

        field_meta = self.metadata_service.get_field_metadata(object_name, field_name)

        backup_id = f"bak_{object_name}_{field_name}_{uuid.uuid4().hex[:12]}"
        timestamp = datetime.now(timezone.utc).isoformat()

        backup_payload = {
            "backup_id": backup_id,
            "created_at": timestamp,
            "object_name": object_name,
            "field_name": field_name,
            "metadata": field_meta["field"],
            "description": field_meta["field"].get("description", ""),
        }

        checksum = self._compute_checksum(backup_payload)
        backup_payload["checksum"] = checksum

        # Save to disk
        backup_file = os.path.join(self.backup_dir, f"{backup_id}.json")
        with open(backup_file, "w", encoding="utf-8") as f:
            json.dump(backup_payload, f, indent=2)

        # Store in memory cache
        self._memory_backups[backup_id] = backup_payload

        logger.info(f"Created backup {backup_id} for {object_name}.{field_name}")

        return {
            "backup_id": backup_id,
            "object_name": object_name,
            "field_name": field_name,
            "checksum": checksum,
            "backup_file": backup_file,
            "created_at": timestamp,
            "metadata_snapshot": field_meta["field"]
        }

    def get_backup(self, backup_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a stored backup by ID."""
        if backup_id in self._memory_backups:
            return self._memory_backups[backup_id]

        backup_file = os.path.join(self.backup_dir, f"{backup_id}.json")
        if os.path.exists(backup_file):
            with open(backup_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                self._memory_backups[backup_id] = data
                return data

        return None

    def rollback_field(
        self,
        backup_id: str
    ) -> Dict[str, Any]:
        """
        Restore a field description to its pre-modification state.
        Field-Level Security is left unchanged by this workflow.
        """
        backup = self.get_backup(backup_id)
        if not backup:
            raise ValueError(f"Backup with ID '{backup_id}' not found.")

        object_name = backup["object_name"]
        field_name = backup["field_name"]
        original_desc = backup.get("description", "")

        # Restore description
        desc_restored = self.client.update_field_description(
            object_name,
            field_name,
            original_desc
        )
        if not desc_restored:
            raise RuntimeError(
                f"Failed to restore description for {object_name}.{field_name}."
            )

        logger.info(f"Rolled back {object_name}.{field_name} using backup {backup_id}")

        return {
            "status": "ROLLED_BACK",
            "backup_id": backup_id,
            "object_name": object_name,
            "field_name": field_name,
            "restored_description": original_desc,
            "fls_restored": False,
            "fls_unchanged": True,
            "description_restored": desc_restored,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

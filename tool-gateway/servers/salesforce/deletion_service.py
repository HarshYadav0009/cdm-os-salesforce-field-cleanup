"""
CDM-OS — Salesforce Field Deletion Service

Tier-3 Controlled Destruction Operation.
Sequence: validate → backup → delete via Metadata API

Key safety checks:
- Field must be custom (__c suffix)
- Field must NOT be a managed package field (double-underscore namespace prefix)
- A metadata backup is always created before the deletion attempt
- confirm_delete must be explicitly True (set only after human approval)
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from .client import SalesforceClient
from .metadata import SalesforceMetadataService
from .backup_service import SalesforceBackupService
from .validators import validate_salesforce_identifier

logger = logging.getLogger("salesforce.deletion_service")

# Managed package fields follow the pattern: namespace__FieldName__c
# They cannot be deleted and must be rejected.
MANAGED_PACKAGE_PATTERN_HELP = (
    "Managed package fields (namespace__FieldName__c) cannot be deleted. "
    "They are owned by the installed package vendor."
)


class SalesforceFieldDeletionService:
    """
    Field Deletion Service — Tier-3 Controlled Destruction.

    Permanently removes a custom field from a Salesforce org.
    Always creates a metadata backup before deletion.
    Supports mock mode (no real Salesforce connection required for tests).
    """

    def __init__(
        self,
        client: Optional[SalesforceClient] = None,
        backup_service: Optional[SalesforceBackupService] = None,
    ):
        self.client = client if client is not None else SalesforceClient()
        self.metadata_service = SalesforceMetadataService(self.client)
        self.backup_service = (
            backup_service
            if backup_service is not None
            else SalesforceBackupService(self.client)
        )

    # ──────────────────────────────────────────────────────────────
    # Validation helpers
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    def _validate_custom_field(field_name: str) -> None:
        """Raise ValueError if the field is not a custom field (must end with __c)."""
        if not field_name.endswith("__c"):
            raise ValueError(
                f"Field '{field_name}' is not a custom field. "
                "Only custom fields (ending in __c) can be deleted."
            )

    @staticmethod
    def _validate_not_managed_package(field_name: str) -> None:
        """
        Raise ValueError if the field belongs to a managed package.
        Managed package fields have a namespace prefix: namespace__FieldName__c
        They contain two or more double-underscore sequences.
        """
        # Count occurrences of '__'
        parts = field_name.split("__")
        # Standard custom field: Name__c  → ['Name', 'c']  → 2 parts
        # Managed package field: ns__Name__c → ['ns', 'Name', 'c'] → 3+ parts
        if len(parts) > 2:
            raise ValueError(
                f"Field '{field_name}' appears to be a managed package field "
                f"(detected namespace prefix). {MANAGED_PACKAGE_PATTERN_HELP}"
            )

    # ──────────────────────────────────────────────────────────────
    # Core deletion
    # ──────────────────────────────────────────────────────────────

    def delete_field(
        self,
        object_name: str,
        field_name: str,
        confirm_delete: bool,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Permanently delete a custom field from a Salesforce org.

        Args:
            object_name: API name of the SObject (e.g. ``Account``).
            field_name:  API name of the custom field (must end with ``__c``).
            confirm_delete: Must be ``True``; gate against accidental calls.
            reason: Optional human-readable justification for the deletion audit trail.

        Returns:
            dict with status, backup_id, object, field, and timestamp.

        Raises:
            ValueError: If the field fails safety validation.
            RuntimeError: If confirm_delete is False or the deletion API call fails.
        """
        object_name = validate_salesforce_identifier(object_name)
        field_name = validate_salesforce_identifier(field_name)

        # Gate: explicit confirmation required
        if not confirm_delete:
            raise RuntimeError(
                "confirm_delete must be True to execute a field deletion. "
                "This value is only set after explicit human approval."
            )

        # Safety validations
        self._validate_custom_field(field_name)
        self._validate_not_managed_package(field_name)

        # Confirm the field actually exists on the object
        field_info = self.metadata_service.get_field_metadata(object_name, field_name)
        field_meta = field_info["field"]

        if not field_meta.get("custom"):
            raise ValueError(
                f"Field '{field_name}' on '{object_name}' is not marked as custom "
                "in Salesforce metadata. Only custom fields can be deleted."
            )

        # Always create a backup before deletion
        backup_result = self.backup_service.backup_field_definition(object_name, field_name)
        backup_id = backup_result["backup_id"]

        logger.info(
            "Backup %s created for %s.%s before deletion. Reason: %s",
            backup_id,
            object_name,
            field_name,
            reason or "not specified",
        )

        # Perform the deletion
        try:
            deleted = self._execute_deletion(object_name, field_name)
        except Exception as exc:
            logger.error(
                "Deletion of %s.%s failed: %s. Backup %s is available for reference.",
                object_name,
                field_name,
                exc,
                backup_id,
            )
            raise RuntimeError(
                f"Field deletion failed: {exc}. "
                f"Metadata backup {backup_id} was created before the attempt."
            ) from exc

        logger.info(
            "Field %s.%s successfully deleted. Backup ID: %s",
            object_name,
            field_name,
            backup_id,
        )

        return {
            "status": "DELETED",
            "object": object_name,
            "field": field_name,
            "backup_id": backup_id,
            "deleted": deleted,
            "reason": reason,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def _execute_deletion(self, object_name: str, field_name: str) -> bool:
        """
        Call the Salesforce Metadata API (or mock) to delete the field.
        Returns True on success.
        """
        if not self.client.is_mock and self.client.sf:
            # Real Salesforce — use Metadata API deleteMetadata
            developer_name = field_name.replace("__c", "")
            full_name = f"{object_name}.{developer_name}"
            try:
                result = self.client.sf.mdapi.CustomField.delete(full_name)
                if isinstance(result, list):
                    success = all(r.get("success", False) for r in result)
                elif isinstance(result, dict):
                    success = result.get("success", False)
                else:
                    success = bool(result)
                if not success:
                    raise RuntimeError(
                        f"Metadata API deleteMetadata returned failure for {full_name}"
                    )
                return True
            except AttributeError:
                # Fallback: use restful Metadata API endpoint if mdapi not available
                raise RuntimeError(
                    "Salesforce Metadata API deletion is not available via this client. "
                    "Ensure simple-salesforce mdapi support is installed."
                )
        else:
            # Mock mode — remove the field from in-memory mock state
            obj_data = self.client._mock_objects.get(object_name)
            if obj_data is None:
                raise ValueError(
                    f"SObject '{object_name}' not found in mock Salesforce org."
                )
            original_count = len(obj_data.get("fields", []))
            obj_data["fields"] = [
                f for f in obj_data.get("fields", [])
                if f.get("name", "").lower() != field_name.lower()
            ]
            removed = len(obj_data["fields"]) < original_count
            if not removed:
                raise ValueError(
                    f"Field '{field_name}' not found on '{object_name}' in mock org."
                )
            return True

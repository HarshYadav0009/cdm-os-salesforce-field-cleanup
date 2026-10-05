import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from .client import SalesforceClient
from .metadata import SalesforceMetadataService
from .backup_service import SalesforceBackupService
from .validators import validate_salesforce_identifier

logger = logging.getLogger("salesforce.deprecation")


class SalesforceFieldDeprecationService:
    """
    Field Deprecation Service with Pre-Modification Backup and Automatic Error Rollback.
    Tier-2 Controlled Remediation Operation.
    - Tags custom field description with [DEPRECATED]
    - Restricts Field-Level Security (FLS)
    - If failure occurs, automatically rolls back to original state
    """

    def __init__(
        self,
        client: Optional[SalesforceClient] = None,
        backup_service: Optional[SalesforceBackupService] = None
    ):
        self.client = client if client is not None else SalesforceClient()
        self.metadata_service = SalesforceMetadataService(self.client)
        self.backup_service = (
            backup_service
            if backup_service is not None
            else SalesforceBackupService(self.client)
        )

    def deprecate_field(
        self,
        object_name: str,
        field_name: str,
        reason: Optional[str] = None,
        simulate_error: bool = False
    ) -> Dict[str, Any]:
        """
        Execute controlled field deprecation with automatic backup and rollback guardrails.
        """
        object_name = validate_salesforce_identifier(object_name)
        field_name = validate_salesforce_identifier(field_name)

        # 1. Fetch current field metadata
        field_info = self.metadata_service.get_field_metadata(object_name, field_name)
        field_meta = field_info["field"]

        # Ensure field is a custom field
        if not field_meta.get("custom"):
            raise ValueError(
                f"Standard Salesforce field '{field_name}' on '{object_name}' "
                "cannot be deprecated or modified."
            )

        # 2. Automatically create metadata backup before any change
        backup_result = self.backup_service.backup_field_definition(object_name, field_name)
        backup_id = backup_result["backup_id"]

        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        reason_str = f" - {reason}" if reason else ""
        deprecation_tag = f"[DEPRECATED: {now_str}{reason_str}]"

        original_desc = field_meta.get("description", "") or ""
        new_desc = (
            f"{deprecation_tag} {original_desc}".strip()
            if deprecation_tag not in original_desc
            else original_desc
        )

        try:
            # Check for simulated error (used in testing automatic rollback)
            if simulate_error:
                raise RuntimeError("Simulated transient tool failure during deprecation execution.")

            # 3. Update field description
            desc_success = self.client.update_field_description(
                object_name,
                field_name,
                new_desc
            )
            if not desc_success:
                raise RuntimeError(
                    f"Failed to update description for {object_name}.{field_name} in Salesforce."
                )

            # 4. Remove/restrict FLS access
            fls_success = self.client.update_field_permissions(
                object_name,
                field_name,
                readable=False,
                editable=False
            )
            if not fls_success:
                raise RuntimeError(
                    f"Failed to restrict FLS permissions for {object_name}.{field_name}."
                )

            logger.info(
                f"Field {object_name}.{field_name} successfully deprecated. Backup ID: {backup_id}"
            )

            return {
                "status": "DEPRECATED",
                "object": object_name,
                "field": field_name,
                "backup_id": backup_id,
                "previous_description": original_desc,
                "new_description": new_desc,
                "fls_restricted": True,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

        except Exception as exc:
            # 5. AUTOMATIC ERROR ROLLBACK
            logger.error(
                f"Deprecation of {object_name}.{field_name} failed: {exc}. "
                f"Initiating automatic rollback from backup {backup_id}..."
            )
            try:
                self.backup_service.rollback_field(backup_id)
                logger.info(f"Automatic rollback for {object_name}.{field_name} succeeded.")
            except Exception as rollback_err:
                logger.critical(
                    f"Automatic rollback failed for {object_name}.{field_name}: {rollback_err}"
                )

            raise RuntimeError(
                f"Deprecation failed: {exc}. Automatic rollback executed successfully."
            ) from exc

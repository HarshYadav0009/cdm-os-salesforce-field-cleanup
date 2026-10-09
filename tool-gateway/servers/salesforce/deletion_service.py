from typing import Any, Dict, Optional

from .backup_service import SalesforceBackupService
from .client import SalesforceClient
from .metadata import SalesforceMetadataService
from .validators import validate_salesforce_identifier


class SalesforceFieldDeletionService:
    """Back up and safely delete a confirmed, unmanaged custom field."""

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

    def delete_field(
        self,
        object_name: str,
        field_name: str,
        confirm_delete: bool,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        if confirm_delete is not True:
            raise ValueError(
                "Explicit confirmation is required before deleting a Salesforce field."
            )

        object_name = validate_salesforce_identifier(object_name)
        field_name = validate_salesforce_identifier(field_name)

        if not field_name.lower().endswith("__c"):
            raise ValueError("Only custom Salesforce fields can be deleted.")
        if "__" in field_name[:-3]:
            raise ValueError("Managed-package fields cannot be deleted by this tool.")

        field_info = self.metadata_service.get_field_metadata(object_name, field_name)
        if not field_info["field"].get("custom", False):
            raise ValueError("Standard Salesforce fields cannot be deleted.")

        backup = self.backup_service.backup_field_definition(object_name, field_name)
        self.client.delete_custom_field(object_name, field_name)

        return {
            "status": "DELETED",
            "object": object_name,
            "field": field_name,
            "backup_id": backup["backup_id"],
            "reason": reason,
            "warning": (
                "The backup preserves field metadata only; it does not restore "
                "the deleted field or its data."
            ),
        }

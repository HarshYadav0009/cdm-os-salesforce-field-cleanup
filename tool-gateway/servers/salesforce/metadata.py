from typing import Dict, Any, List, Optional
from .client import SalesforceClient
from .validators import validate_salesforce_identifier


class SalesforceMetadataService:
    """
    Salesforce Metadata Inspection Service.
    Provides read-only inspection of SObjects, custom fields, and global org schemas.
    """

    def __init__(self, client: Optional[SalesforceClient] = None):
        self.client = client if client is not None else SalesforceClient()

    def describe_global(self) -> Dict[str, Any]:
        """Return summary of all SObjects available in the Salesforce org."""
        res = self.client.describe_global()
        sobjects = res.get("sobjects", [])
        return {
            "total_sobjects": len(sobjects),
            "custom_sobjects": [s["name"] for s in sobjects if s.get("custom")],
            "standard_sobjects": [s["name"] for s in sobjects if not s.get("custom")],
            "sobjects": sobjects,
        }

    def describe_object(self, object_name: str) -> Dict[str, Any]:
        """Return comprehensive metadata for a specific Salesforce object."""
        if not object_name:
            raise ValueError("object_name is required")

        object_name = validate_salesforce_identifier(object_name)
        description = self.client.describe(object_name)

        fields = []
        for field in description.get("fields", []):
            fields.append({
                "name": field.get("name"),
                "label": field.get("label"),
                "type": field.get("type"),
                "length": field.get("length"),
                "precision": field.get("precision"),
                "scale": field.get("scale"),
                "nillable": field.get("nillable"),
                "createable": field.get("createable"),
                "updateable": field.get("updateable"),
                "calculated": field.get("calculated", False),
                "custom": field.get("custom", False),
                "description": field.get("description", "")
            })

        return {
            "object": description.get("name"),
            "label": description.get("label"),
            "custom": description.get("custom", False),
            "fields": fields,
            "total_fields": len(fields),
            "custom_fields_count": sum(1 for f in fields if f.get("custom"))
        }

    def get_field_metadata(self, object_name: str, field_name: str) -> Dict[str, Any]:
        """Retrieve metadata for a single field on a Salesforce SObject."""
        if not object_name:
            raise ValueError("object_name is required")
        if not field_name:
            raise ValueError("field_name is required")

        object_name = validate_salesforce_identifier(object_name)
        field_name = validate_salesforce_identifier(field_name)

        desc = self.describe_object(object_name)
        for f in desc.get("fields", []):
            if f["name"].lower() == field_name.lower():
                return {
                    "object": object_name,
                    "field": f
                }

        raise ValueError(f"Field '{field_name}' not found on object '{object_name}'")

    def list_custom_fields(self, object_name: str) -> List[Dict[str, Any]]:
        """List all custom fields on a given Salesforce object."""
        desc = self.describe_object(object_name)
        return [f for f in desc.get("fields", []) if f.get("custom")]
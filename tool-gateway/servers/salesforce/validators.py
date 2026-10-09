import re
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, field_validator


def validate_salesforce_identifier(value: str) -> str:
    """Validate standard or custom Salesforce API identifier."""
    if not value or not isinstance(value, str):
        raise ValueError("Salesforce identifier must be a non-empty string.")

    value = value.strip()
    if len(value) > 80:
        raise ValueError(f"Salesforce identifier exceeds 80 characters: '{value}'")

    if not re.match(r"^[A-Za-z][A-Za-z0-9_]*$", value):
        raise ValueError(
            f"Invalid Salesforce identifier '{value}'. Must begin with a letter and contain only alphanumeric characters or underscores."
        )

    # Disallow consecutive underscores (violates Salesforce naming rules)
    if "__" in value and not value.endswith("__c"):
        raise ValueError(f"Salesforce identifier cannot contain consecutive underscores: '{value}'")

    return value


# ============================================================
# PYDANTIC INPUT PAYLOAD SCHEMAS
# ============================================================

class DescribeObjectSchema(BaseModel):
    object_name: str = Field(..., description="Salesforce SObject API name (e.g., Account, Custom_Object__c)")

    @field_validator("object_name")
    def check_identifier(cls, v):
        return validate_salesforce_identifier(v)


class FieldUsageSchema(BaseModel):
    object_name: str = Field(..., description="Salesforce SObject API name")
    field_name: str = Field(..., description="Salesforce field API name")

    @field_validator("object_name", "field_name")
    def check_identifier(cls, v):
        return validate_salesforce_identifier(v)


class ScanApexReferencesSchema(BaseModel):
    object_name: str = Field(..., description="Salesforce SObject API name")
    field_name: str = Field(..., description="Salesforce field API name")

    @field_validator("object_name", "field_name")
    def check_identifier(cls, v):
        return validate_salesforce_identifier(v)


class DeprecateFieldSchema(BaseModel):
    object_name: str = Field(..., description="Salesforce SObject API name")
    field_name: str = Field(..., description="Salesforce custom field API name")
    reason: Optional[str] = Field(None, description="Optional rationale for deprecation")
    simulate_error: Optional[bool] = Field(False, description="For testing rollback behavior")

    @field_validator("object_name", "field_name")
    def check_identifier(cls, v):
        return validate_salesforce_identifier(v)


class BackupFieldSchema(BaseModel):
    object_name: str = Field(..., description="Salesforce SObject API name")
    field_name: str = Field(..., description="Salesforce field API name")

    @field_validator("object_name", "field_name")
    def check_identifier(cls, v):
        return validate_salesforce_identifier(v)


class DeleteFieldSchema(BaseModel):
    object_name: str = Field(..., description="Salesforce SObject API name")
    field_name: str = Field(..., description="Unmanaged custom field API name")
    confirm_delete: bool = Field(
        ...,
        description="Must be true; deletion requires prior human approval and explicit confirmation",
    )
    reason: Optional[str] = Field(None, description="Reason recorded with the deletion")

    @field_validator("object_name", "field_name")
    def check_identifier(cls, v):
        return validate_salesforce_identifier(v)


class RollbackFieldSchema(BaseModel):
    backup_id: str = Field(..., description="Unique backup identifier created during pre-modification snapshot")


class BulkScanSchema(BaseModel):
    object_names: Optional[List[str]] = Field(None, description="Optional list of SObject names to scan")
    threshold_percentage: Optional[float] = Field(0.0, ge=0.0, le=100.0, description="Usage % threshold")

    @field_validator("object_names")
    def check_list(cls, v):
        if v is not None:
            return [validate_salesforce_identifier(name) for name in v]
        return v


# Map of tool_name to validation schema
TOOL_PAYLOAD_SCHEMAS = {
    "salesforce_describe_object": DescribeObjectSchema,
    "salesforce_get_field_metadata": FieldUsageSchema,
    "salesforce_query_field_usage": FieldUsageSchema,
    "salesforce_scan_apex_references": ScanApexReferencesSchema,
    "salesforce_full_field_assessment": FieldUsageSchema,
    "salesforce_deprecate_field": DeprecateFieldSchema,
    "salesforce_backup_field_definition": BackupFieldSchema,
    "salesforce_delete_field": DeleteFieldSchema,
    "salesforce_rollback_field": RollbackFieldSchema,
    "salesforce_bulk_scan": BulkScanSchema,
}


def validate_tool_payload(tool_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate input payload against the registered schema for tool_name.
    Raises ValueError on validation failure.
    """
    schema_cls = TOOL_PAYLOAD_SCHEMAS.get(tool_name)
    if not schema_cls:
        # No strict schema or parameterless tool (e.g. salesforce_health_check, salesforce_describe_global)
        return payload or {}

    try:
        validated = schema_cls(**(payload or {}))
        return validated.model_dump()
    except Exception as exc:
        raise ValueError(f"Schema validation failed for '{tool_name}': {exc}") from exc
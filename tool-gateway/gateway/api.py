from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .service import ToolGatewayService

app = FastAPI(
    title="CDM-OS Tool Gateway",
    version="1.0.0",
    description="Governed Model Context Protocol (MCP) Tool Gateway for Salesforce and External Systems"
)

gateway = ToolGatewayService()


# ============================================================
# DTO REQUEST MODELS
# ============================================================

class ObjectRequest(BaseModel):
    object_name: str = Field(..., description="Salesforce SObject API name (e.g. Account)")


class FieldRequest(BaseModel):
    object_name: str = Field(..., description="Salesforce SObject API name")
    field_name: str = Field(..., description="Salesforce Field API name")


class DeprecateRequest(BaseModel):
    object_name: str
    field_name: str
    reason: Optional[str] = None


class DeleteFieldRequest(BaseModel):
    object_name: str
    field_name: str
    confirm_delete: bool = Field(
        ...,
        description="Must be true after explicit human approval",
    )
    reason: Optional[str] = None


class RollbackRequest(BaseModel):
    backup_id: str


class BulkScanRequest(BaseModel):
    object_names: Optional[List[str]] = None
    threshold_percentage: Optional[float] = 0.0


class GenericExecuteRequest(BaseModel):
    tool_name: str
    arguments: Dict[str, Any] = Field(default_factory=dict)


# ============================================================
# API ENDPOINTS
# ============================================================

@app.get("/health")
async def health():
    try:
        result = await gateway.health_check()
        return {
            "status": "healthy",
            "gateway": "tool-gateway",
            "salesforce": result
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/tools")
async def tools():
    return {
        "tools": await gateway.list_tools()
    }


@app.post("/tools/salesforce/describe-global")
async def describe_global():
    try:
        return await gateway.describe_global()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/tools/salesforce/describe")
async def describe_object(request: ObjectRequest):
    try:
        return await gateway.describe_object(request.object_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/tools/salesforce/field-metadata")
async def field_metadata(request: FieldRequest):
    try:
        return await gateway.get_field_metadata(request.object_name, request.field_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/tools/salesforce/field-usage")
async def field_usage(request: FieldRequest):
    try:
        return await gateway.query_field_usage(request.object_name, request.field_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/tools/salesforce/scan-references")
async def scan_references(request: FieldRequest):
    try:
        return await gateway.scan_apex_references(request.object_name, request.field_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/tools/salesforce/full-assessment")
def full_field_assessment(request: FieldRequest):
    try:
        return gateway.full_field_assessment(
            request.object_name,
            request.field_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/tools/salesforce/backup")
async def backup_field(request: FieldRequest):
    try:
        return await gateway.backup_field_definition(request.object_name, request.field_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/tools/salesforce/deprecate")
async def deprecate_field(request: DeprecateRequest):
    try:
        return await gateway.deprecate_field(request.object_name, request.field_name, request.reason)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/tools/salesforce/delete")
async def delete_field(request: DeleteFieldRequest):
    try:
        return await gateway.delete_field(
            request.object_name,
            request.field_name,
            request.confirm_delete,
            request.reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/tools/salesforce/rollback")
async def rollback_field(request: RollbackRequest):
    try:
        return await gateway.rollback_field(request.backup_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/tools/salesforce/bulk-scan")
async def bulk_scan(request: BulkScanRequest):
    try:
        return await gateway.bulk_scan(request.object_names, request.threshold_percentage or 0.0)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/tools/execute")
async def execute_tool(request: GenericExecuteRequest):
    try:
        return await gateway.execute_tool(request.tool_name, request.arguments)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .service import ToolGatewayService


app = FastAPI(
    title="CDM-OS Tool Gateway",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class FieldUsageRequest(BaseModel):

    object_name: str
    field_name: str


gateway = ToolGatewayService()


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

        raise HTTPException(
            status_code=500,
            detail=str(exc)
        )


@app.get("/tools")
async def tools():

    try:
        tool_list = await gateway.salesforce.list_tools()
        return {
            "tools": [
                {
                    "name": t.name,
                    "description": t.description,
                }
                for t in tool_list
            ]
        }
    except Exception as exc:
        return {
            "tools": [
                {"name": "salesforce_describe_object", "description": "Read Salesforce object metadata"},
                {"name": "salesforce_query_field_usage", "description": "Analyze Salesforce field population"},
                {"name": "salesforce_health_check", "description": "Verify Salesforce connectivity"},
            ],
            "source": "static_fallback",
            "error": str(exc),
        }



@app.post("/tools/salesforce/describe")
async def describe_object(
    request: dict
):

    object_name = request.get(
        "object_name"
    )

    if not object_name:

        raise HTTPException(
            status_code=400,
            detail="object_name is required"
        )

    try:

        return await gateway.describe_object(
            object_name
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc)
        )


@app.post("/tools/salesforce/field-usage")
async def field_usage(
    request: FieldUsageRequest
):

    try:

        return await gateway.query_field_usage(
            request.object_name,
            request.field_name
        )

    except Exception as exc:

        raise HTTPException(
            status_code=500,
            detail=str(exc)
        )
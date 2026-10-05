import os
from typing import Dict, Any, List, Optional
import httpx


class ToolGatewayClient:
    """
    HTTP Client consumed by Agent Runtime to communicate with the Governed Tool Gateway.
    """

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (
            base_url
            or os.getenv("TOOL_GATEWAY_URL", "http://127.0.0.1:8001")
        ).rstrip("/")

    async def health_check(self) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(f"{self.base_url}/health")
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise RuntimeError(
                f"Cannot connect to Tool Gateway at {self.base_url}. Ensure Tool Gateway server is running."
            ) from exc

    async def list_tools(self) -> List[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(f"{self.base_url}/tools")
                resp.raise_for_status()
                return resp.json().get("tools", [])
        except httpx.ConnectError as exc:
            raise RuntimeError(f"Cannot connect to Tool Gateway at {self.base_url}.") from exc

    async def describe_global(self) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(f"{self.base_url}/tools/salesforce/describe-global")
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise RuntimeError(f"Cannot connect to Tool Gateway at {self.base_url}.") from exc

    async def describe_object(self, object_name: str) -> Dict[str, Any]:
        if not object_name:
            raise ValueError("object_name is required")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.base_url}/tools/salesforce/describe",
                    json={"object_name": object_name}
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise RuntimeError(f"Cannot connect to Tool Gateway at {self.base_url}.") from exc

    async def field_usage(self, object_name: str, field_name: str) -> Dict[str, Any]:
        if not object_name or not field_name:
            raise ValueError("object_name and field_name are required")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.base_url}/tools/salesforce/field-usage",
                    json={"object_name": object_name, "field_name": field_name}
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise RuntimeError(f"Cannot connect to Tool Gateway at {self.base_url}.") from exc

    async def scan_references(self, object_name: str, field_name: str) -> Dict[str, Any]:
        if not object_name or not field_name:
            raise ValueError("object_name and field_name are required")
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.base_url}/tools/salesforce/scan-references",
                    json={"object_name": object_name, "field_name": field_name}
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise RuntimeError(f"Cannot connect to Tool Gateway at {self.base_url}.") from exc

    async def backup_field(self, object_name: str, field_name: str) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.base_url}/tools/salesforce/backup",
                    json={"object_name": object_name, "field_name": field_name}
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise RuntimeError(f"Cannot connect to Tool Gateway at {self.base_url}.") from exc

    async def deprecate_field(
        self,
        object_name: str,
        field_name: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.base_url}/tools/salesforce/deprecate",
                    json={"object_name": object_name, "field_name": field_name, "reason": reason}
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise RuntimeError(f"Cannot connect to Tool Gateway at {self.base_url}.") from exc

    async def rollback_field(self, backup_id: str) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{self.base_url}/tools/salesforce/rollback",
                    json={"backup_id": backup_id}
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise RuntimeError(f"Cannot connect to Tool Gateway at {self.base_url}.") from exc

    async def bulk_scan(
        self,
        object_names: Optional[List[str]] = None,
        threshold_percentage: float = 0.0
    ) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(
                    f"{self.base_url}/tools/salesforce/bulk-scan",
                    json={"object_names": object_names, "threshold_percentage": threshold_percentage}
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise RuntimeError(f"Cannot connect to Tool Gateway at {self.base_url}.") from exc
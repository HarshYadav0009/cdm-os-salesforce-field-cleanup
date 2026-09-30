import os

import httpx


class ToolGatewayClient:

    def __init__(
        self,
        base_url=None
    ):

        self.base_url = (
            base_url
            or os.getenv(
                "TOOL_GATEWAY_URL",
                "http://127.0.0.1:8001"
            )
        ).rstrip("/")


    async def health_check(self):

        try:

            async with httpx.AsyncClient(
                timeout=60.0
            ) as client:

                response = await client.get(
                    f"{self.base_url}/health"
                )

                response.raise_for_status()

                return response.json()

        except httpx.ConnectError as exc:

            raise RuntimeError(
                f"Cannot connect to Tool Gateway at "
                f"{self.base_url}. "
                f"Make sure the Tool Gateway is running "
                f"on port 8001."
            ) from exc


    async def list_tools(self):

        try:

            async with httpx.AsyncClient(
                timeout=60.0
            ) as client:

                response = await client.get(
                    f"{self.base_url}/tools"
                )

                response.raise_for_status()

                return response.json()

        except httpx.ConnectError as exc:

            raise RuntimeError(
                f"Cannot connect to Tool Gateway at "
                f"{self.base_url}."
            ) from exc


    async def describe_object(
        self,
        object_name: str
    ):

        if not object_name:
            raise ValueError(
                "object_name is required"
            )

        try:

            async with httpx.AsyncClient(
                timeout=60.0
            ) as client:

                response = await client.post(
                    f"{self.base_url}/tools/salesforce/describe",
                    json={
                        "object_name": object_name
                    }
                )

                response.raise_for_status()

                return response.json()

        except httpx.ConnectError as exc:

            raise RuntimeError(
                f"Cannot connect to Tool Gateway at "
                f"{self.base_url}."
            ) from exc


    async def field_usage(
        self,
        object_name: str,
        field_name: str
    ):

        if not object_name:
            raise ValueError(
                "object_name is required"
            )

        if not field_name:
            raise ValueError(
                "field_name is required"
            )

        try:

            async with httpx.AsyncClient(
                timeout=60.0
            ) as client:

                response = await client.post(
                    f"{self.base_url}/tools/salesforce/field-usage",
                    json={
                        "object_name": object_name,
                        "field_name": field_name
                    }
                )

                response.raise_for_status()

                return response.json()

        except httpx.ConnectError as exc:

            raise RuntimeError(
                f"Cannot connect to Tool Gateway at "
                f"{self.base_url}."
            ) from exc
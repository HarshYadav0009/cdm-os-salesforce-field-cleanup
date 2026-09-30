import os

import httpx


class ProposalService:

    def __init__(
        self,
        control_plane_url=None
    ):

        self.control_plane_url = (
            control_plane_url
            or os.getenv(
                "CONTROL_PLANE_URL",
                "http://127.0.0.1:8000"
            )
        ).rstrip("/")

    async def submit_proposal(
        self,
        proposal: dict,
        agent_id: str,
        tool_id: str
    ) -> dict:

        if not proposal:
            raise ValueError(
                "proposal is required"
            )

        if not agent_id:
            raise ValueError(
                "agent_id is required"
            )

        if not tool_id:
            raise ValueError(
                "tool_id is required"
            )

        payload = {
            "agent_id": agent_id,
            "tool_id": tool_id,
            "input_payload": proposal
        }

        url = (
            f"{self.control_plane_url}"
            "/api/v1/proposals/"
        )

        try:

            async with httpx.AsyncClient(
                timeout=60.0
            ) as client:

                response = await client.post(
                    url,
                    json=payload
                )

                response.raise_for_status()

                return response.json()

        except httpx.ConnectError as exc:

            raise RuntimeError(
                "Unable to connect to Control Plane "
                f"at {self.control_plane_url}. "
                "Make sure the Control Plane is running."
            ) from exc

        except httpx.HTTPStatusError as exc:

            raise RuntimeError(
                "Control Plane rejected the proposal. "
                f"HTTP {exc.response.status_code}: "
                f"{exc.response.text}"
            ) from exc
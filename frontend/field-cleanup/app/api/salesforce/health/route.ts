import { decodeGatewayResponse } from "../../../lib/api/gatewayResponse";

export async function GET() {
  const gatewayUrl = (
    process.env.TOOL_GATEWAY_URL ??
    process.env.MCP_GATEWAY_URL ??
    process.env.NEXT_PUBLIC_TOOL_GATEWAY_URL ??
    "http://127.0.0.1:8080"
  ).replace(/\/$/, "");

  try {
    const response = await fetch(`${gatewayUrl}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return Response.json({ status: "offline" }, { status: 503 });
    }

    const result = decodeGatewayResponse(await response.json());
    if (typeof result === "string") {
      if (!result.trim() || ["unhealthy", "offline", "error"].includes(result.trim().toLowerCase())) {
        return Response.json({ status: "offline" }, { status: 503 });
      }
      return Response.json({ status: "online", salesforce_connected: null, message: result });
    }
    if (typeof result !== "object" || result === null) {
      return Response.json({ status: "offline" }, { status: 503 });
    }
    const salesforce = "salesforce" in result && typeof result.salesforce === "object" && result.salesforce !== null
      ? result.salesforce : {};
    if (("status" in result && !["healthy", "ok"].includes(String(result.status))) ||
      ("salesforce_connected" in salesforce && salesforce.salesforce_connected === false)) {
      return Response.json({ status: "offline" }, { status: 503 });
    }

    return Response.json({
      status: "online",
      salesforce_connected: "salesforce_connected" in salesforce && salesforce.salesforce_connected === true ? true : null,
      is_mock: "is_mock" in salesforce && salesforce.is_mock === true,
      org_type:
        "org_type" in salesforce && typeof salesforce.org_type === "string"
          ? salesforce.org_type
          : null,
      org_name:
        "org_name" in salesforce && typeof salesforce.org_name === "string"
          ? salesforce.org_name
          : null,
      org_user_name:
        "org_user_name" in salesforce &&
        typeof salesforce.org_user_name === "string"
          ? salesforce.org_user_name
          : null,
    });
  } catch {
    return Response.json({ status: "offline" }, { status: 503 });
  }
}

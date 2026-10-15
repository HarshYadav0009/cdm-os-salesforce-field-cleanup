export async function GET() {
  const gatewayUrl = (
    process.env.TOOL_GATEWAY_URL ??
    process.env.MCP_GATEWAY_URL ??
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

    const result: unknown = await response.json();
    if (typeof result !== "object" || result === null || !("salesforce" in result)) {
      return Response.json({ status: "offline" }, { status: 503 });
    }

    const salesforce = result.salesforce;
    if (
      typeof salesforce !== "object" ||
      salesforce === null ||
      !("salesforce_connected" in salesforce) ||
      salesforce.salesforce_connected !== true
    ) {
      return Response.json({ status: "offline" }, { status: 503 });
    }

    return Response.json({
      status: "online",
      is_mock: "is_mock" in salesforce && salesforce.is_mock === true,
    });
  } catch {
    return Response.json({ status: "offline" }, { status: 503 });
  }
}

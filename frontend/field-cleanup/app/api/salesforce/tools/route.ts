export async function GET() {
  const gatewayUrl = (
    process.env.TOOL_GATEWAY_URL ??
    process.env.MCP_GATEWAY_URL ??
    process.env.NEXT_PUBLIC_TOOL_GATEWAY_URL ??
    "http://127.0.0.1:8080"
  ).replace(/\/$/, "");
  try {
    const response = await fetch(`${gatewayUrl}/tools`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    return new Response(response.body, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return Response.json(
      { detail: "Unable to load the gateway tool catalog." },
      { status: 502 },
    );
  }
}

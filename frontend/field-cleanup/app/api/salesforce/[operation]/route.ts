const OPERATIONS = {
  "describe-global": "/tools/salesforce/describe-global",
  describe: "/tools/salesforce/describe",
  "field-usage": "/tools/salesforce/field-usage",
  "scan-references": "/tools/salesforce/scan-references",
  "field-metadata": "/tools/salesforce/field-metadata",
  "bulk-scan": "/tools/salesforce/bulk-scan",
  execute: "/tools/execute",
} as const;

// Mutating tools must go through control-plane policy and proposal execution.
const READ_TOOLS = new Set([
  "salesforce_health_check",
  "salesforce_describe_global",
  "salesforce_describe_object",
  "salesforce_get_field_metadata",
  "salesforce_query_field_usage",
  "salesforce_scan_apex_references",
  "salesforce_full_field_assessment",
  "salesforce_bulk_scan",
]);

type Operation = keyof typeof OPERATIONS;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ operation: string }> },
) {
  const { operation } = await params;
  if (!Object.prototype.hasOwnProperty.call(OPERATIONS, operation)) {
    return Response.json(
      { detail: "Unknown Salesforce operation." },
      { status: 404 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { detail: "Request body must be valid JSON." },
      { status: 400 },
    );
  }
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload)
  ) {
    return Response.json(
      { detail: "Request body must be an object." },
      { status: 400 },
    );
  }
  if (
    operation === "execute" &&
    (!("tool_name" in payload) ||
      typeof payload.tool_name !== "string" ||
      !READ_TOOLS.has(payload.tool_name))
  ) {
    return Response.json(
      {
        detail:
          "Use a control-plane proposal for changes to Salesforce fields.",
      },
      { status: 403 },
    );
  }

  const gatewayUrl = (
    process.env.TOOL_GATEWAY_URL ??
    process.env.MCP_GATEWAY_URL ??
    "http://127.0.0.1:8080"
  ).replace(/\/$/, "");

  try {
    const response = await fetch(
      `${gatewayUrl}${OPERATIONS[operation as Operation]}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
        signal: AbortSignal.timeout(
          operation === "bulk-scan" || operation === "execute"
            ? 300000
            : 120000,
        ),
      },
    );
    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : "Unable to reach the Tool Gateway.";
    return Response.json(
      { detail: `Salesforce Tool Gateway request failed: ${detail}` },
      { status: 502 },
    );
  }
}

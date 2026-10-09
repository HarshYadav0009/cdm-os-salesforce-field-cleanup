const OPERATIONS = {
  "describe-global": "/tools/salesforce/describe-global",
  describe: "/tools/salesforce/describe",
  "field-usage": "/tools/salesforce/field-usage",
  "scan-references": "/tools/salesforce/scan-references",
} as const;

type Operation = keyof typeof OPERATIONS;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ operation: string }> },
) {
  const { operation } = await params;
  if (!Object.prototype.hasOwnProperty.call(OPERATIONS, operation)) {
    return Response.json({ detail: "Unknown Salesforce operation." }, { status: 404 });
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
        body: await request.text(),
        cache: "no-store",
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
      error instanceof Error ? error.message : "Unable to reach the Tool Gateway.";
    return Response.json(
      { detail: `Salesforce Tool Gateway request failed: ${detail}` },
      { status: 502 },
    );
  }
}

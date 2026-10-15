export async function GET() {
  try {
    const base = (
      process.env.CONTROL_PLANE_URL ??
      process.env.NEXT_PUBLIC_CONTROL_PLANE_URL ??
      process.env.NEXT_PUBLIC_API_BASE ??
      "http://127.0.0.1:8000"
    )
      .replace(/\/$/, "")
      .replace(/\/api\/v1$/, "");
    const response = await fetch(`${base}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const result: unknown = await response.json();
    if (
      !response.ok ||
      typeof result !== "object" ||
      result === null ||
      !("status" in result) ||
      (result.status !== "healthy" && result.status !== "ok")
    ) {
      return Response.json({ status: "offline" }, { status: 503 });
    }
    return Response.json({ status: "online" });
  } catch {
    return Response.json({ status: "offline" }, { status: 503 });
  }
}

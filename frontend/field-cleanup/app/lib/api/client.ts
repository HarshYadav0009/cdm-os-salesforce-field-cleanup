import { mapReadResponse } from "./contracts";
// src/lib/api/client.ts
const DEFAULT_API_BASE = "http://localhost:8000/api/v1";
const controlPlane = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL?.replace(/\/$/, "");
export const BASE = (process.env.NEXT_PUBLIC_API_BASE ??
  (controlPlane ? `${controlPlane}/api/v1` : DEFAULT_API_BASE)).replace(/\/$/, "");

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${path.startsWith("http") ? "" : BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
  });

  if (!res.ok) {
    const detail = await res.text();
    let message = "";
    try {
      if (res.headers.get("content-type")?.includes("json")) {
        const parsed: unknown = JSON.parse(detail);
        if (typeof parsed === "string") {
          message = parsed;
        } else if (typeof parsed === "object" && parsed !== null) {
          if ("detail" in parsed && typeof parsed.detail === "string") {
            message = parsed.detail;
          } else if ("detail" in parsed && Array.isArray(parsed.detail)) {
            message = parsed.detail.map((item: unknown) => {
              if (!item || typeof item !== "object") return "Invalid request field";
              const issue = item as { loc?: unknown[]; msg?: unknown };
              const location = Array.isArray(issue.loc) ? issue.loc.filter((part) => part !== "body").map(String).join(".") : "request";
              return `${location}: ${typeof issue.msg === "string" ? issue.msg : "Invalid value"}`;
            }).join("; ");
          } else if ("message" in parsed && typeof parsed.message === "string") {
            message = parsed.message;
          }
        }
      } else if (detail && !detail.trimStart().startsWith("<")) {
        message = detail.slice(0, 200);
      }
    } catch {
      // Invalid error payloads are reported using the HTTP status alone.
    }
    throw new Error(
      message ? `${res.status} ${res.statusText}: ${message}` : `${res.status} ${res.statusText}`,
    );
  }

  if (res.status === 204) return undefined as T;
  const body = await res.text();
  if (!body.trim()) return undefined as T;
  let data: unknown = JSON.parse(body);
  const read = (init?.method ?? "GET").toUpperCase() === "GET";
  // The list contract contains summaries. Fetch details for existing views that
  // need tool, field, tier, policy, or backup information. Bound concurrency.
  if (read && path.split("?")[0].replace(/\/$/, "") === "/proposals" && Array.isArray(data)) {
    const summaries = data;
    const detailed: unknown[] = [];
    for (let offset = 0; offset < summaries.length; offset += 6) {
      detailed.push(...await Promise.all(summaries.slice(offset, offset + 6).map(async (summary) => {
        if (!summary || typeof summary !== "object" || !("id" in summary) || typeof summary.id !== "string") {
          throw new Error("The proposal list returned an invalid summary.");
        }
        // The repository returns full rows; the compact contract returns summaries.
        if ("tool_id" in summary && "input_payload" in summary && "tier" in summary) return summary;
        try {
          const detail = await api<Record<string, unknown>>(`/proposals/${encodeURIComponent(summary.id)}`, init);
          return { ...summary, ...detail };
        } catch (error) {
          if (init?.signal?.aborted) throw error;
          // Preserve this history row; opening details offers its own retry.
          return summary;
        }
      })));
    }
    data = detailed;
  }
  return ((init?.method ?? "GET").toUpperCase() === "GET"
    ? mapReadResponse(path, data) : data) as T;
}

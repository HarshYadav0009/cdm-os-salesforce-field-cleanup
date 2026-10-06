// src/lib/api/client.ts
const DEFAULT_API_BASE = "http://localhost:8000/api/v1";
export const BASE = process.env.NEXT_PUBLIC_API_BASE ?? DEFAULT_API_BASE;

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
  return res.json() as Promise<T>;
}

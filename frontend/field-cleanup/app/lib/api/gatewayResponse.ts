// Some gateway deployments return JSON objects encoded inside a JSON string.
// Plain message strings stay strings; they are never treated as empty results.
export function decodeGatewayResponse(value: unknown): unknown {
  for (let depth = 0; depth < 3 && typeof value === "string"; depth += 1) {
    try {
      const decoded: unknown = JSON.parse(value);
      if (decoded === value) break;
      value = decoded;
    } catch { break; }
  }
  return value;
}

export function gatewayObject(value: unknown, operation: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const detail = typeof value === "string" ? ` Response: ${value.slice(0, 500)}` : "";
    throw new Error(`Tool Gateway ${operation} did not return the structured data this screen needs.${detail}`);
  }
  return value as Record<string, unknown>;
}

export function gatewayArguments(toolId: string, payload: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, string[]> = {
    salesforce_backup_field_def: ["object_name", "field_name"],
    salesforce_backup_field_definition: ["object_name", "field_name"],
    salesforce_deprecate_field: ["object_name", "field_name", "reason"],
    salesforce_delete_field: ["object_name", "field_name", "confirm_delete", "reason"],
    salesforce_rollback_field: ["backup_id"],
  };
  const keys = fields[toolId];
  return keys ? Object.fromEntries(keys.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]])) : payload;
}

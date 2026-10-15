import { normalizeBulkScan } from "./bulkScan";
import { decodeGatewayResponse, gatewayObject } from "./gatewayResponse";

export interface SalesforceObjectSummary {
  name: string;
  label: string;
  custom: boolean;
}

export interface SalesforceFieldMetadata {
  name: string;
  label: string;
  type: string;
  length?: number | null;
  precision?: number | null;
  scale?: number | null;
  nillable?: boolean;
  createable?: boolean;
  updateable?: boolean;
  calculated?: boolean;
  custom?: boolean;
  description?: string;
}

export interface SalesforceObjectDescription {
  object: string;
  label: string;
  custom: boolean;
  fields: SalesforceFieldMetadata[];
  total_fields: number;
  custom_fields_count: number;
}

export interface SalesforceFieldUsage {
  object: string;
  field: string;
  total_records: number;
  populated_records: number;
  usage_percentage: number;
  zero_usage_candidate: boolean;
  recommendation_hint: string;
}

export interface SalesforceReference {
  type: string;
  id?: string;
  name?: string;
  line_number?: number;
  snippet?: string;
  description?: string;
}

export interface SalesforceReferenceScan {
  has_references: boolean;
  reference_count: number;
  summary: string;
  all_references: SalesforceReference[];
}

async function post<T>(
  operation: string,
  payload?: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/salesforce/${operation}`, {
    method: "POST",
    ...(payload === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    signal,
  });

  let value = decodeGatewayResponse(await response.json());
  if (!response.ok) {
    const detail = typeof value === "string" ? value : value && typeof value === "object"
      ? (value as Record<string, unknown>).detail ?? (value as Record<string, unknown>).message : null;
    throw new Error(typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : `Salesforce request failed (${response.status} ${response.statusText}).`);
  }
  if (operation === "bulk-scan") value = normalizeBulkScan(value);
  if (operation !== "execute" && operation !== "full-assessment") {
    const data = gatewayObject(value, operation);
    const valid = operation === "describe-global" ? Array.isArray(data.sobjects)
      : operation === "describe" ? Array.isArray(data.fields)
      : operation === "field-metadata" ? !!data.field && typeof data.field === "object"
      : operation === "field-usage" ? [data.total_records, data.populated_records, data.usage_percentage].every((item) => typeof item === "number")
      : operation === "scan-references" ? typeof data.has_references === "boolean" && typeof data.reference_count === "number"
      : operation === "bulk-scan" ? [data.candidates, data.needs_review, data.active_fields, data.objects_scanned].every(Array.isArray) && !!data.breakdown_by_object && typeof data.breakdown_by_object === "object" && [data.total_custom_fields_scanned, data.total_candidates_found, data.total_needs_review, data.total_active_in_use].every((item) => typeof item === "number")
      : true;
    if (!valid) throw new Error(`Tool Gateway ${operation} returned an unexpected response. Required result fields are missing.`);
  }
  return value as T;
}

export const SalesforceAPI = {
  listTools: async (
    signal?: AbortSignal,
  ): Promise<{ tools: GatewayTool[] }> => {
    const response = await fetch("/api/salesforce/tools", {
      cache: "no-store",
      signal,
    });
    if (!response.ok)
      throw new Error("Unable to load the gateway tool catalog. Please retry.");
    const value = gatewayObject(decodeGatewayResponse(await response.json()), "tools");
    if (!Array.isArray(value.tools)) throw new Error("The Tool Gateway tools response does not include a tool list.");
    return value as unknown as { tools: GatewayTool[] };
  },
  fieldMetadata: (object_name: string, field_name: string) =>
    post<{ object: string; field: SalesforceFieldMetadata }>("field-metadata", {
      object_name,
      field_name,
    }),
  bulkScan: (object_names: string[] | null, threshold_percentage: number) =>
    post<BulkScanResult>("bulk-scan", { object_names, threshold_percentage }),
  executeReadTool: (tool_name: string, arguments_: Record<string, unknown>) =>
    post<unknown>("execute", { tool_name, arguments: arguments_ }),
  describeGlobal: (signal?: AbortSignal) =>
    post<{ sobjects: SalesforceObjectSummary[] }>(
      "describe-global",
      undefined,
      signal,
    ),
  fullAssessment: (object_name: string, field_name: string, signal?: AbortSignal) =>
    post<unknown>("full-assessment", { object_name, field_name }, signal),
  describeObject: (object_name: string, signal?: AbortSignal) =>
    post<SalesforceObjectDescription>("describe", { object_name }, signal),
  fieldUsage: (object_name: string, field_name: string, signal?: AbortSignal) =>
    post<SalesforceFieldUsage>("field-usage", { object_name, field_name }, signal),
  scanReferences: async (object_name: string, field_name: string, signal?: AbortSignal): Promise<SalesforceReferenceScan> => {
    const result = await post<SalesforceReferenceScan & {
      references?: Record<string, string[]>;
    }>("scan-references", { object_name, field_name }, signal);
    // Support both the gateway's detailed rows and the handoff's grouped names.
    const types: Record<string, string> = {
      apex_classes: "ApexClass", triggers: "ApexTrigger", flows: "Flow",
      validation_rules: "ValidationRule",
    };
    return {
      ...result,
      all_references: result.all_references ?? Object.entries(result.references ?? {})
        .flatMap(([group, names]) => names.map((name) => ({ type: types[group] ?? group, name }))),
    };
  },
};

export interface GatewayTool {
  tool_id: string;
  name: string;
  description: string;
  tier: string;
}

export interface BulkScanField {
  object: string;
  field: string;
  label: string;
  type: string;
  usage_percentage: number;
  populated_records?: number;
  total_records?: number;
  reference_count?: number;
  has_references?: boolean;
  reference_summary: string;
  classification: string;
}

export interface BulkScanResult {
  threshold_percentage?: number;
  skipped_fields?: {
    object: string;
    field: string;
    stage: string;
    reason: string;
  }[];
  total_skipped_fields?: number;
  object_errors?: { object: string; stage: string; reason: string }[];
  scan_timestamp?: string;
  objects_scanned: string[];
  total_custom_fields_scanned: number;
  total_candidates_found: number;
  total_needs_review: number;
  total_active_in_use: number;
  breakdown_by_object: Record<string, { custom_fields_count?: number; fields_count?: number }>;
  candidates: BulkScanField[];
  needs_review: BulkScanField[];
  active_fields: BulkScanField[];
}

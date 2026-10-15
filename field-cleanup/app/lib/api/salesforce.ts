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
  payload: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/salesforce/${operation}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as {
      detail?: string;
      message?: string;
    } | null;
    throw new Error(
      detail?.detail ??
        detail?.message ??
        `Salesforce request failed (${response.status} ${response.statusText}).`,
    );
  }

  return (await response.json()) as T;
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
    return response.json();
  },
  fieldMetadata: (object_name: string, field_name: string) =>
    post<{ object: string; field: SalesforceFieldMetadata }>("field-metadata", {
      object_name,
      field_name,
    }),
  bulkScan: (object_names: string[], threshold_percentage: number) =>
    post<BulkScanResult>("bulk-scan", { object_names, threshold_percentage }),
  executeReadTool: (tool_name: string, arguments_: Record<string, unknown>) =>
    post<unknown>("execute", { tool_name, arguments: arguments_ }),
  describeGlobal: (signal?: AbortSignal) =>
    post<{ sobjects: SalesforceObjectSummary[] }>(
      "describe-global",
      {},
      signal,
    ),
  describeObject: (object_name: string, signal?: AbortSignal) =>
    post<SalesforceObjectDescription>("describe", { object_name }, signal),
  fieldUsage: (object_name: string, field_name: string) =>
    post<SalesforceFieldUsage>("field-usage", { object_name, field_name }),
  scanReferences: (object_name: string, field_name: string) =>
    post<SalesforceReferenceScan>("scan-references", {
      object_name,
      field_name,
    }),
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
  populated_records: number;
  total_records: number;
  reference_count: number;
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
  scan_timestamp: string;
  objects_scanned: string[];
  total_custom_fields_scanned: number;
  total_candidates_found: number;
  total_needs_review: number;
  total_active_in_use: number;
  breakdown_by_object: Record<string, { custom_fields_count: number }>;
  candidates: BulkScanField[];
  needs_review: BulkScanField[];
  active_fields: BulkScanField[];
}

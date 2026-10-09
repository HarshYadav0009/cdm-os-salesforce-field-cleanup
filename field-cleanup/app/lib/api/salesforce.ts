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
  payload: Record<string, string>,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api/salesforce/${operation}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as
      | { detail?: string; message?: string }
      | null;
    throw new Error(
      detail?.detail ??
        detail?.message ??
        `Salesforce request failed (${response.status} ${response.statusText}).`,
    );
  }

  return (await response.json()) as T;
}

export const SalesforceAPI = {
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

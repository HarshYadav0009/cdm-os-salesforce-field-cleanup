import type { BulkScanField, BulkScanResult } from "./salesforce";
import { gatewayObject } from "./gatewayResponse";

const classifications: Record<string, string> = {
  CLEANUP_CANDIDATE: "CANDIDATE_FOR_CLEANUP",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  ACTIVE: "ACTIVE_IN_USE",
  CANDIDATE_FOR_CLEANUP: "CANDIDATE_FOR_CLEANUP",
  ACTIVE_IN_USE: "ACTIVE_IN_USE",
};
const count = (value: unknown, name: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Bulk scan response has an invalid ${name}.`);
  return value;
};

export function normalizeBulkScan(value: unknown): BulkScanResult {
  const source = gatewayObject(value, "bulk-scan");
  if (!source.scan_summary && !source.objects) return source as unknown as BulkScanResult;
  const summary = gatewayObject(source.scan_summary, "bulk-scan summary");
  if (!Array.isArray(source.objects)) throw new Error("Bulk scan response must include an objects array.");
  const fields: BulkScanField[] = [];
  const objects: string[] = [];
  const breakdown: BulkScanResult["breakdown_by_object"] = {};
  for (const item of source.objects) {
    const object = gatewayObject(item, "bulk-scan object");
    if (typeof object.object_name !== "string" || !Array.isArray(object.fields)) throw new Error("Bulk scan object is missing its name or fields.");
    objects.push(object.object_name);
    breakdown[object.object_name] = { fields_count: object.fields.length };
    for (const item of object.fields) {
      const field = gatewayObject(item, "bulk-scan field");
      const classification = typeof field.classification === "string" ? classifications[field.classification] : undefined;
      if (typeof field.field_name !== "string" || !classification || typeof field.has_references !== "boolean") throw new Error("Bulk scan field is missing its name, classification, or reference status.");
      const population = count(field.usage_percentage, "usage percentage");
      if (population > 100) throw new Error("Bulk scan usage percentage must be between 0 and 100.");
      fields.push({
        object: object.object_name, field: field.field_name,
        label: typeof field.label === "string" ? field.label : field.field_name,
        type: typeof field.type === "string" ? field.type : "Not supplied",
        classification, usage_percentage: population, has_references: field.has_references,
        ...(typeof field.total_records === "number" ? { total_records: count(field.total_records, "record count") } : {}),
        ...(typeof field.populated_records === "number" ? { populated_records: count(field.populated_records, "populated record count") } : {}),
        ...(typeof field.reference_count === "number" ? { reference_count: count(field.reference_count, "reference count") } : {}),
        reference_summary: typeof field.reference_summary === "string" ? field.reference_summary
          : field.has_references ? "References found; inspect the field for details." : "No references found.",
      });
    }
  }
  return {
    ...source,
    objects_scanned: objects, breakdown_by_object: breakdown,
    total_custom_fields_scanned: count(summary.total_fields, "total fields"),
    total_candidates_found: count(summary.cleanup_candidates, "cleanup candidates"),
    total_needs_review: count(summary.needs_review, "fields needing review"),
    total_active_in_use: count(summary.active_fields, "active fields"),
    candidates: fields.filter((field) => field.classification === "CANDIDATE_FOR_CLEANUP"),
    needs_review: fields.filter((field) => field.classification === "NEEDS_REVIEW"),
    active_fields: fields.filter((field) => field.classification === "ACTIVE_IN_USE"),
  };
}

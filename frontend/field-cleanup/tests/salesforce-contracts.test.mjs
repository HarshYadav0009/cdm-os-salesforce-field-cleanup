import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function loadApi(fetch) {
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, { exports, fetch, require: (name) => load(path.resolve(path.dirname(file), `${name}.ts`)) });
    return exports;
  }
  return {
    ...load(path.join(root, "app/lib/api/salesforce.ts")),
    ...load(path.join(root, "app/lib/api/gatewayResponse.ts")),
  };
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const field = { name: "Legacy__c", label: "Legacy", type: "string" };
const usage = { object: "Account", field: "Legacy__c", total_records: 10, populated_records: 0, usage_percentage: 0, zero_usage_candidate: true, recommendation_hint: "Review references" };

test("read endpoints send exact gateway request bodies and decode JSON strings", async () => {
  const calls = [];
  const bulk = { candidates: [], needs_review: [], active_fields: [], objects_scanned: ["Account"], breakdown_by_object: {}, total_custom_fields_scanned: 0, total_candidates_found: 0, total_needs_review: 0, total_active_in_use: 0 };
  const results = {
    "describe-global": { sobjects: [{ name: "Account", label: "Account", custom: false }] },
    describe: { object: "Account", fields: [field] },
    "field-metadata": { object: "Account", field },
    "field-usage": usage,
    "scan-references": { has_references: false, reference_count: 0, summary: "None found", all_references: [] },
    "full-assessment": "Assessment finished",
    "bulk-scan": bulk,
    execute: "Read tool finished",
  };
  const { SalesforceAPI } = loadApi(async (url, init) => {
    const operation = url.split("/").at(-1);
    calls.push({ operation, body: init.body ? JSON.parse(init.body) : undefined });
    return Response.json(typeof results[operation] === "string" ? results[operation] : JSON.stringify(results[operation]));
  });
  assert.equal((await SalesforceAPI.describeGlobal()).sobjects[0].name, "Account");
  assert.equal((await SalesforceAPI.describeObject("Account")).fields[0].name, field.name);
  assert.equal((await SalesforceAPI.fieldMetadata("Account", field.name)).field.type, "string");
  assert.equal((await SalesforceAPI.fieldUsage("Account", field.name)).usage_percentage, 0);
  assert.equal((await SalesforceAPI.scanReferences("Account", field.name)).reference_count, 0);
  assert.equal(await SalesforceAPI.fullAssessment("Account", field.name), "Assessment finished");
  assert.equal((await SalesforceAPI.bulkScan(["Account"], 0)).total_candidates_found, 0);
  assert.equal(await SalesforceAPI.executeReadTool("salesforce_describe_object", { object_name: "Account" }), "Read tool finished");
  const target = { object_name: "Account", field_name: field.name };
  assert.deepEqual(calls, [
    { operation: "describe-global", body: undefined },
    { operation: "describe", body: { object_name: "Account" } },
    ...["field-metadata", "field-usage", "scan-references", "full-assessment"].map((operation) => ({ operation, body: target })),
    { operation: "bulk-scan", body: { object_names: ["Account"], threshold_percentage: 0 } },
    { operation: "execute", body: { tool_name: "salesforce_describe_object", arguments: { object_name: "Account" } } },
  ]);
});

test("plain strings and malformed structured responses produce usable errors instead of empty findings", async () => {
  for (const response of ["Assessment unavailable", { usage_percentage: 0 }]) {
    const { SalesforceAPI } = loadApi(async () => Response.json(response));
    await assert.rejects(SalesforceAPI.fieldUsage("Account", field.name), /structured data|Required result fields/);
  }
  const { SalesforceAPI } = loadApi(async () => Response.json("Invalid field", { status: 400 }));
  await assert.rejects(SalesforceAPI.fieldUsage("Account", field.name), /Invalid field/);
});

test("tool catalogs decode encoded objects and reject plain messages", async () => {
  const { SalesforceAPI } = loadApi(async (url, init) => {
    assert.equal(url, "/api/salesforce/tools");
    assert.equal(init.cache, "no-store");
    return Response.json(JSON.stringify({ tools: [{ tool_id: "salesforce_describe_object" }] }));
  });
  assert.equal((await SalesforceAPI.listTools()).tools[0].tool_id, "salesforce_describe_object");
  const invalid = loadApi(async () => Response.json("Tools unavailable"));
  await assert.rejects(invalid.SalesforceAPI.listTools(), /Tools unavailable/);
});

test("governed mutation arguments match the gateway DTOs without extra aliases", () => {
  const { gatewayArguments } = loadApi(() => { throw new Error("No gateway calls expected"); });
  const input = { object_name: "Account", field_name: field.name, field_api_name: field.name, reason: "Reviewed", confirm_delete: true, backup_id: "b1" };
  assert.deepEqual(plain(gatewayArguments("salesforce_backup_field_def", input)), { object_name: "Account", field_name: field.name });
  assert.deepEqual(plain(gatewayArguments("salesforce_deprecate_field", input)), { object_name: "Account", field_name: field.name, reason: "Reviewed" });
  assert.deepEqual(plain(gatewayArguments("salesforce_delete_field", input)), { object_name: "Account", field_name: field.name, confirm_delete: true, reason: "Reviewed" });
  assert.deepEqual(plain(gatewayArguments("salesforce_rollback_field", input)), { backup_id: "b1" });
});

test("document bulk scans map nested objects and classifications to the existing results and proposal flow", async () => {
  const documented = {
    scan_summary: { total_fields: 3, cleanup_candidates: 1, needs_review: 1, active_fields: 1 },
    objects: [{ object_name: "Account", fields: [
      { field_name: "Empty__c", classification: "CLEANUP_CANDIDATE", usage_percentage: 0, has_references: false },
      { field_name: "Referenced__c", classification: "NEEDS_REVIEW", usage_percentage: 0, has_references: true },
      { field_name: "Active__c", classification: "ACTIVE", usage_percentage: 80, has_references: true },
    ] }],
  };
  for (const body of [documented, JSON.stringify(documented)]) {
    const { SalesforceAPI, gatewayArguments } = loadApi(async () => Response.json(body));
    const result = await SalesforceAPI.bulkScan(["Account"], 0);
    assert.equal(result.total_custom_fields_scanned, 3);
    assert.equal(result.total_candidates_found, 1);
    assert.equal(result.total_needs_review, 1);
    assert.equal(result.total_active_in_use, 1);
    assert.deepEqual(plain(result.objects_scanned), ["Account"]);
    assert.equal(result.candidates[0].classification, "CANDIDATE_FOR_CLEANUP");
    assert.equal(result.needs_review[0].field, "Referenced__c");
    assert.equal(result.active_fields[0].classification, "ACTIVE_IN_USE");
    assert.equal(result.needs_review[0].reference_count, undefined);
    assert.equal(result.candidates[0].total_records, undefined);
    assert.equal(result.scan_timestamp, undefined);
    assert.equal(result.needs_review[0].has_references, true);
    assert.deepEqual(plain(gatewayArguments("salesforce_deprecate_field", {
      object_name: result.candidates[0].object, field_name: result.candidates[0].field, reason: "Review empty field",
    })), { object_name: "Account", field_name: "Empty__c", reason: "Review empty field" });
  }
});

test("empty nested scans are valid and malformed counts or classifications fail clearly", async () => {
  const base = { scan_summary: { total_fields: 0, cleanup_candidates: 0, needs_review: 0, active_fields: 0 }, objects: [] };
  const { SalesforceAPI } = loadApi(async () => Response.json(base));
  assert.deepEqual(plain((await SalesforceAPI.bulkScan(null, 0)).candidates), []);
  for (const bad of [
    { ...base, scan_summary: { ...base.scan_summary, total_fields: -1 } },
    { ...base, objects: [{ object_name: "Account", fields: [{ field_name: "Field__c", classification: "UNKNOWN", usage_percentage: 0, has_references: false }] }] },
  ]) {
    const { SalesforceAPI } = loadApi(async () => Response.json(bad));
    await assert.rejects(SalesforceAPI.bulkScan(null, 0), /Bulk scan/);
  }
});

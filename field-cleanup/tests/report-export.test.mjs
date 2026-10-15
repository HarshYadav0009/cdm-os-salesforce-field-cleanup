import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync(new URL("../app/lib/api/reportExport.ts", import.meta.url), "utf8");
const context = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
const { csvCell, escapeHtml } = context.exports;

test("CSV exports preserve commas, quotes and multiline payloads", () => {
  assert.equal(csvCell('Field, "Legacy"\nDescription'), '"Field, ""Legacy""\nDescription"');
});

test("CSV exports neutralize spreadsheet formula prefixes", () => {
  for (const value of ["=HYPERLINK(\"https://example.test\")", "+1", "-1", "@SUM(A1)", "  =1", "\tformula"]) {
    assert.ok(csvCell(value).startsWith('"\''));
  }
  assert.equal(csvCell("Account.Legacy__c"), '"Account.Legacy__c"');
});

test("print reports escape untrusted event content", () => {
  assert.equal(escapeHtml('<script>alert("x")</script>&'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;');
});

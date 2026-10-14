import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the pagination hook with retained state across renders and polling.
function harness() {
  let state;
  const context = {
    exports: {},
    require(name) {
      if (name === "react") return {
        useState(initial) {
          state ??= initial;
          return [state, (next) => { state = next; }];
        },
      };
      return {};
    },
  };
  const source = fs.readFileSync(new URL("../app/Components/shared/TablePagination.tsx", import.meta.url), "utf8");
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText, context);
  return context.exports.useTablePagination;
}
const records = Array.from({ length: 31 }, (_, id) => ({ id, name: `Row ${id}` }));

test("pagination exposes every record exactly once, with at most 15 per page", () => {
  const render = harness();
  const seen = [];
  for (let page = 0; page < 3; page++) {
    let result = render(records);
    result.onPageChange(page);
    result = render(records);
    assert.equal(result.page, page);
    assert.equal(result.pageCount, 3);
    assert.ok(result.visibleRows.length <= 15);
    seen.push(...result.visibleRows.map((row) => row.id));
  }
  assert.deepEqual(seen, records.map((row) => row.id));
});

test("polling preserves the current page, while filters and ordering reset it", () => {
  const render = harness();
  render(records).onPageChange(2);
  assert.equal(render(records.map((row) => ({ ...row, name: "Updated" }))).page, 2);
  const filtered = render(records.slice(0, 4));
  assert.equal(filtered.page, 0);
  assert.equal(filtered.visibleRows.length, 4);
  assert.equal(render([...records].reverse()).page, 0);
});

test("empty datasets and out-of-range requests remain within valid bounds", () => {
  const render = harness();
  let result = render([]);
  assert.equal(result.page, 0);
  assert.equal(result.pageCount, 1);
  assert.equal(result.visibleRows.length, 0);
  result = render(records);
  result.onPageChange(99);
  assert.equal(render(records).page, 2);
  render(records).onPageChange(-1);
  assert.equal(render(records).page, 0);
});

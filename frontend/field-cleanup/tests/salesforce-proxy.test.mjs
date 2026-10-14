import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));

function loadRoute(
  relativePath,
  fetch,
  env = { TOOL_GATEWAY_URL: "http://gateway.test:8080/" },
) {
  const source = fs.readFileSync(
    path.join(testDirectory, "..", relativePath),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const context = {
    exports: {},
    Request,
    Response,
    AbortSignal,
    fetch,
    process: { env },
  };
  vm.runInNewContext(code, context);
  return context.exports;
}

function request(payload) {
  return new Request("http://localhost/api/salesforce/execute", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
  });
}

test("all field inspection and bulk operations forward the exact payload", async () => {
  for (const operation of [
    "describe-global",
    "describe",
    "field-metadata",
    "field-usage",
    "scan-references",
    "bulk-scan",
  ]) {
    let forwarded;
    const route = loadRoute(
      "app/api/salesforce/[operation]/route.ts",
      async (url, options) => {
        forwarded = { url, options };
        return Response.json({ result: "ok" });
      },
    );
    const payload =
      operation === "bulk-scan"
        ? { object_names: ["Account", "Contact"], threshold_percentage: 2.5 }
        : { object_name: "Account", field_name: "Legacy__c" };
    const response = await route.POST(request(payload), {
      params: Promise.resolve({ operation }),
    });
    assert.equal(response.status, 200);
    assert.equal(
      forwarded.url,
      `http://gateway.test:8080/tools/salesforce/${operation}`,
    );
    assert.equal(forwarded.options.method, "POST");
    assert.deepEqual(JSON.parse(forwarded.options.body), payload);
  }
});

test("generic execution forwards read checks but blocks mutation and unknown tools", async () => {
  let calls = 0;
  const route = loadRoute(
    "app/api/salesforce/[operation]/route.ts",
    async (url, options) => {
      calls++;
      assert.equal(url, "http://gateway.test:8080/tools/execute");
      assert.equal(
        JSON.parse(options.body).tool_name,
        "salesforce_get_field_metadata",
      );
      return Response.json({ field: { name: "Legacy__c" } });
    },
  );
  const params = { params: Promise.resolve({ operation: "execute" }) };
  const result = await route.POST(
    request({
      tool_name: "salesforce_get_field_metadata",
      arguments: { object_name: "Account", field_name: "Legacy__c" },
    }),
    params,
  );
  assert.equal(result.status, 200);
  for (const tool of [
    "salesforce_delete_field",
    "salesforce_deprecate_field",
    "salesforce_rollback_field",
    "salesforce_backup_field_definition",
    "unknown",
  ]) {
    assert.equal(
      (await route.POST(request({ tool_name: tool, arguments: {} }), params))
        .status,
      403,
    );
  }
  assert.equal(calls, 1);
});

test("unknown routes and malformed bodies never reach the gateway", async () => {
  const route = loadRoute("app/api/salesforce/[operation]/route.ts", () => {
    throw new Error("Unexpected upstream call");
  });
  for (const operation of [
    "rollback",
    "delete",
    "backup",
    "deprecate",
    "unknown",
  ]) {
    assert.equal(
      (
        await route.POST(request({}), {
          params: Promise.resolve({ operation }),
        })
      ).status,
      404,
    );
  }
  for (const body of ["{", "[]", "null", '"text"']) {
    const response = await route.POST(
      new Request("http://localhost/api/salesforce/describe", {
        method: "POST",
        body,
      }),
      { params: Promise.resolve({ operation: "describe" }) },
    );
    assert.equal(response.status, 400);
  }
});

test("gateway validation errors and connection failures remain actionable", async () => {
  const params = { params: Promise.resolve({ operation: "field-usage" }) };
  const invalid = loadRoute(
    "app/api/salesforce/[operation]/route.ts",
    async () => Response.json({ detail: "Invalid field" }, { status: 400 }),
  );
  const response = await invalid.POST(request({}), params);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { detail: "Invalid field" });
  const offline = loadRoute(
    "app/api/salesforce/[operation]/route.ts",
    async () => {
      throw new Error("Connection refused");
    },
  );
  assert.equal((await offline.POST(request({}), params)).status, 502);
});

test("catalog uses the gateway tools endpoint without caching", async () => {
  const route = loadRoute(
    "app/api/salesforce/tools/route.ts",
    async (url, options) => {
      assert.equal(url, "http://gateway.test:8080/tools");
      assert.equal(options.cache, "no-store");
      return Response.json({ tools: [{ tool_id: "salesforce_bulk_scan" }] });
    },
  );
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.equal(
    (await response.json()).tools[0].tool_id,
    "salesforce_bulk_scan",
  );
});

test("control-plane health uses the configured API root and checks the health payload", async () => {
  for (const [env, expected] of [
    [{}, "http://127.0.0.1:8000/health"],
    [
      { NEXT_PUBLIC_API_BASE: "https://api.test/api/v1/" },
      "https://api.test/health",
    ],
    [
      {
        CONTROL_PLANE_URL: "http://backend:8000/",
        NEXT_PUBLIC_API_BASE: "http://ignored/api/v1",
      },
      "http://backend:8000/health",
    ],
  ]) {
    const route = loadRoute(
      "app/api/control-plane/health/route.ts",
      async (url, options) => {
        assert.equal(url, expected);
        assert.equal(options.cache, "no-store");
        assert.ok(options.signal);
        return Response.json({ status: "ok" });
      },
      env,
    );
    const response = await route.GET();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "online" });
  }
});

test("control-plane health reports offline for errors, invalid payloads and timeouts", async () => {
  for (const fetch of [
    async () => Response.json({ status: "ok" }, { status: 500 }),
    async () => Response.json({ status: "unhealthy" }),
    async () => Response.json(null),
    async () => new Response("not JSON"),
    async () => {
      throw new Error("Timeout");
    },
  ]) {
    const route = loadRoute("app/api/control-plane/health/route.ts", fetch);
    const response = await route.GET();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "offline" });
  }
});

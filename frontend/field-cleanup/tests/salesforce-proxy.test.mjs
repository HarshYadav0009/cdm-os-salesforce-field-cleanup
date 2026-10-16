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
  const cache = new Map();
  function load(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(code, {
      exports, Request, Response, AbortSignal, fetch, process: { env },
      require: (name) => load(path.resolve(path.dirname(file), `${name}.ts`)),
    });
    return exports;
  }
  return load(path.join(testDirectory, "..", relativePath));
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
    "full-assessment",
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
        return Response.json({ status: "healthy" });
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
    async () => Response.json({ status: "healthy" }, { status: 500 }),
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

test("public gateway configuration supports org-wide bulk scans", async () => {
  let forwarded;
  const route = loadRoute(
    "app/api/salesforce/[operation]/route.ts",
    async (url, options) => {
      forwarded = { url, payload: JSON.parse(options.body) };
      return Response.json({ candidates: [] });
    },
    { NEXT_PUBLIC_TOOL_GATEWAY_URL: "http://public-gateway.test:8080/" },
  );
  const response = await route.POST(
    request({ object_names: null, threshold_percentage: 0 }),
    { params: Promise.resolve({ operation: "bulk-scan" }) },
  );
  assert.equal(response.status, 200);
  assert.equal(forwarded.url, "http://public-gateway.test:8080/tools/salesforce/bulk-scan");
  assert.deepEqual(forwarded.payload, { object_names: null, threshold_percentage: 0 });
});

test("public control-plane origin configures the health check", async () => {
  let requested;
  const route = loadRoute(
    "app/api/control-plane/health/route.ts",
    async (url) => {
      requested = url;
      return Response.json({ status: "healthy" });
    },
    { NEXT_PUBLIC_CONTROL_PLANE_URL: "http://control.test:8000/" },
  );
  assert.equal((await route.GET()).status, 200);
  assert.equal(requested, "http://control.test:8000/health");
});


test("control-plane health accepts the repository backend's ok status", async () => {
  const route = loadRoute("app/api/control-plane/health/route.ts", async () =>
    Response.json({ status: "ok", environment: "local", version: "0.1.0" }),
  );
  const response = await route.GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "online" });
});

test("describe-global forwards a POST with no request body", async () => {
  const route = loadRoute("app/api/salesforce/[operation]/route.ts", async (url, init) => {
    assert.equal(url, "http://gateway.test:8080/tools/salesforce/describe-global");
    assert.equal(init.method, "POST");
    assert.equal(init.body, undefined);
    return Response.json(JSON.stringify({ sobjects: [] }));
  });
  const response = await route.POST(new Request("http://localhost/api/salesforce/describe-global", { method: "POST" }), {
    params: Promise.resolve({ operation: "describe-global" }),
  });
  assert.equal(response.status, 200);
  assert.equal(await response.json(), JSON.stringify({ sobjects: [] }));
});

test("gateway health accepts string responses without inventing Salesforce connection details", async () => {
  for (const value of ["healthy", JSON.stringify({ status: "healthy" })]) {
    const route = loadRoute("app/api/salesforce/health/route.ts", async () => Response.json(value));
    const response = await route.GET();
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.status, "online");
    assert.equal(result.salesforce_connected, null);
  }
});

test("gateway health preserves explicit Salesforce failures and rejects unhealthy strings", async () => {
  for (const value of ["unhealthy", { status: "healthy", salesforce: { salesforce_connected: false } }]) {
    const route = loadRoute("app/api/salesforce/health/route.ts", async () => Response.json(value));
    assert.equal((await route.GET()).status, 503);
  }
});

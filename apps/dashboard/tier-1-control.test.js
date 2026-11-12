const { test } = require("node:test");
const assert = require("node:assert/strict");
const { handler } = require("../../netlify/functions/tier-1-control");

const configVariables = ["RENDER_API_KEY", "TIER_1_RENDER_SERVICE_ID"];

function setup(t, { apiKey = "test-api-key", serviceId = "srv-test123" } = {}) {
  const previousValues = Object.fromEntries(
    configVariables.map((name) => [name, process.env[name]])
  );
  const originalFetch = global.fetch;
  process.env.RENDER_API_KEY = apiKey;
  process.env.TIER_1_RENDER_SERVICE_ID = serviceId;

  t.after(() => {
    for (const [name, value] of Object.entries(previousValues)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
    global.fetch = originalFetch;
  });
}

function event(action, overrides = {}) {
  return {
    httpMethod: "POST",
    headers: { origin: "https://dashboard.example.net", host: "dashboard.example.net" },
    body: JSON.stringify({ action }),
    ...overrides
  };
}

test("suspend and resume call only the configured Render service", async (t) => {
  setup(t);
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok: true, status: 202 };
  };

  for (const action of ["suspend", "resume"]) {
    const response = await handler(event(action));
    assert.equal(response.statusCode, 202);
    assert.deepEqual(JSON.parse(response.body), { accepted: true, action });
  }

  assert.deepEqual(
    requests.map(({ url, options }) => [url, options.method]),
    [
      ["https://api.render.com/v1/services/srv-test123/suspend", "POST"],
      ["https://api.render.com/v1/services/srv-test123/resume", "POST"]
    ]
  );
  assert.ok(requests.every(({ options }) => options.headers.Authorization === "Bearer test-api-key"));
});

test("rejects cross-origin calls and invalid actions without contacting Render", async (t) => {
  setup(t);
  global.fetch = async () => {
    assert.fail("Render must not be called for a rejected request");
  };

  const crossOrigin = await handler(event("suspend", {
    headers: { origin: "https://attacker.example", host: "dashboard.example.net" }
  }));
  assert.equal(crossOrigin.statusCode, 403);

  const invalidAction = await handler(event("delete"));
  assert.equal(invalidAction.statusCode, 400);
});

test("reports missing Render configuration and upstream errors", async (t) => {
  setup(t, { apiKey: "", serviceId: "" });
  const notConfigured = await handler(event("suspend"));
  assert.equal(notConfigured.statusCode, 503);

  process.env.RENDER_API_KEY = "test-api-key";
  process.env.TIER_1_RENDER_SERVICE_ID = "srv-test123";
  global.fetch = async () => ({ ok: false, status: 401 });

  const rejected = await handler(event("resume"));
  assert.equal(rejected.statusCode, 502);
  assert.deepEqual(JSON.parse(rejected.body), {
    error: "render_rejected_action",
    detail: "Render respondeu HTTP 401."
  });
});

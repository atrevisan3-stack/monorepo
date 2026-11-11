const { test } = require("node:test");
const assert = require("node:assert/strict");
const { handler } = require("../functions/status");

const urlVariables = ["TIER_1_URL", "TIER_2_URL", "TIER_3_URL"];

function restoreEnvironment(t) {
  const previousValues = Object.fromEntries(
    urlVariables.map((name) => [name, process.env[name]])
  );
  const originalFetch = global.fetch;

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

test("status function checks configured health endpoints and returns service URLs", async (t) => {
  restoreEnvironment(t);
  process.env.TIER_1_URL = "https://orders.example.test/";
  process.env.TIER_2_URL = "https://notifications.example.test";
  process.env.TIER_3_URL = "https://analytics.example.test";
  const checkedUrls = [];

  global.fetch = async (url) => {
    checkedUrls.push(url);
    return { ok: true, status: 200 };
  };

  const response = await handler();
  const payload = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.deepEqual(checkedUrls.sort(), [
    "https://analytics.example.test/healthz",
    "https://notifications.example.test/healthz",
    "https://orders.example.test/healthz"
  ]);
  assert.deepEqual(payload.services.map((service) => service.url), [
    "https://orders.example.test",
    "https://notifications.example.test",
    "https://analytics.example.test"
  ]);
  assert.ok(payload.services.every((service) => service.online));
});

test("status function reports unconfigured and invalid URLs as offline", async (t) => {
  restoreEnvironment(t);
  delete process.env.TIER_1_URL;
  process.env.TIER_2_URL = "javascript:alert(1)";
  process.env.TIER_3_URL = "https://user:password@analytics.example.test";
  global.fetch = async () => {
    throw new Error("fetch should not be called for invalid URLs");
  };

  const response = await handler();
  const payload = JSON.parse(response.body);

  assert.deepEqual(
    payload.services.map(({ online, url }) => ({ online, url })),
    [
      { online: false, url: undefined },
      { online: false, url: undefined },
      { online: false, url: undefined }
    ]
  );
  assert.deepEqual(
    payload.services.map((service) => service.detail),
    [
      "URL não configurada",
      "A URL deve usar HTTP ou HTTPS",
      "A URL não deve conter credenciais"
    ]
  );
});

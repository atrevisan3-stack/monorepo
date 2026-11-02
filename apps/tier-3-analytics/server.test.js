const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("./server");

let server;
let baseUrl;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("health endpoint identifies the low-criticality tier", async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", tier: 3 });
});

test("root endpoint lists the available analytics routes", async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: "analytics",
    tier: 3,
    endpoints: { health: "/healthz", summary: "/reports/summary" }
  });
});

test("summary endpoint returns the demo report", async () => {
  const response = await fetch(`${baseUrl}/reports/summary`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.ordersProcessed, 128);
});

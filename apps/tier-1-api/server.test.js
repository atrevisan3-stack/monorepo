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

test("health endpoint identifies the critical tier", async () => {
  const response = await fetch(`${baseUrl}/healthz`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", tier: 1 });
});

test("root endpoint lists the available API routes", async () => {
  const response = await fetch(`${baseUrl}/`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: "orders-api",
    tier: 1,
    endpoints: { health: "/healthz", orders: "/orders" }
  });
});

test("orders endpoint returns the demo orders", async () => {
  const response = await fetch(`${baseUrl}/orders`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.length, 2);
});

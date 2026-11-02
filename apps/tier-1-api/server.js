const http = require("node:http");

const orders = [
  { id: "ORD-1001", status: "confirmed", total: 149.9 },
  { id: "ORD-1002", status: "processing", total: 89.5 }
];

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function createServer() {
  return http.createServer((request, response) => {
    if (request.method === "GET" && request.url === "/") {
      return sendJson(response, 200, {
        service: "orders-api",
        tier: 1,
        endpoints: { health: "/healthz", orders: "/orders" }
      });
    }

    if (request.method === "GET" && request.url === "/healthz") {
      return sendJson(response, 200, { status: "ok", tier: 1 });
    }

    if (request.method === "GET" && request.url === "/orders") {
      return sendJson(response, 200, { data: orders });
    }

    return sendJson(response, 404, { error: "not_found" });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3001);
  const server = createServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`Tier 1 API listening on port ${port}`);
  });

  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  process.on("SIGINT", () => server.close(() => process.exit(0)));
}

module.exports = { createServer };

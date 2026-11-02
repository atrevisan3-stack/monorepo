const http = require("node:http");

const summary = {
  period: "2026-11",
  ordersProcessed: 128,
  grossRevenue: 12450.75
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function createServer() {
  return http.createServer((request, response) => {
    if (request.method === "GET" && request.url === "/") {
      return sendJson(response, 200, {
        service: "analytics",
        tier: 3,
        endpoints: { health: "/healthz", summary: "/reports/summary" }
      });
    }

    if (request.method === "GET" && request.url === "/healthz") {
      return sendJson(response, 200, { status: "ok", tier: 3 });
    }

    if (request.method === "GET" && request.url === "/reports/summary") {
      return sendJson(response, 200, { data: summary });
    }

    return sendJson(response, 404, { error: "not_found" });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3003);
  const server = createServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`Tier 3 analytics listening on port ${port}`);
  });

  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  process.on("SIGINT", () => server.close(() => process.exit(0)));
}

module.exports = { createServer };

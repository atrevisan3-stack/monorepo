const http = require("node:http");

const notifications = [
  { id: "NTF-2001", channel: "email", status: "queued" },
  { id: "NTF-2002", channel: "sms", status: "sent" }
];

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function createServer() {
  return http.createServer((request, response) => {
    if (request.method === "GET" && request.url === "/") {
      return sendJson(response, 200, {
        service: "notifications",
        tier: 2,
        endpoints: { health: "/healthz", notifications: "/notifications" }
      });
    }

    if (request.method === "GET" && request.url === "/healthz") {
      return sendJson(response, 200, { status: "ok", tier: 2 });
    }

    if (request.method === "GET" && request.url === "/notifications") {
      return sendJson(response, 200, { data: notifications });
    }

    return sendJson(response, 404, { error: "not_found" });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3002);
  const server = createServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`Tier 2 notifications listening on port ${port}`);
  });

  process.on("SIGTERM", () => server.close(() => process.exit(0)));
  process.on("SIGINT", () => server.close(() => process.exit(0)));
}

module.exports = { createServer };

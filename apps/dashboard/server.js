const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const publicDirectory = path.join(__dirname, "public");
const services = [
  { id: "tier-1", name: "API de pedidos", tier: 1, port: 3001 },
  { id: "tier-2", name: "Notificações", tier: 2, port: 3002 },
  { id: "tier-3", name: "Analytics", tier: 3, port: 3003 }
];
const assets = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" }
};

async function checkService(service) {
  try {
    const response = await fetch(`http://127.0.0.1:${service.port}/healthz`, {
      signal: AbortSignal.timeout(1500)
    });
    if (!response.ok) {
      return { ...service, online: false, detail: `HTTP ${response.status}` };
    }

    return { ...service, online: true, detail: "Saúde confirmada" };
  } catch (error) {
    return { ...service, online: false, detail: error.message };
  }
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function createServer() {
  return http.createServer(async (request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;

    if (request.method === "GET" && pathname === "/api/status") {
      const results = await Promise.all(services.map(checkService));
      return sendJson(response, 200, {
        checkedAt: new Date().toISOString(),
        services: results
      });
    }

    const asset = assets[pathname];
    if (request.method === "GET" && asset) {
      try {
        const content = await fs.promises.readFile(path.join(publicDirectory, asset.file));
        response.writeHead(200, {
          "content-type": asset.type,
          "cache-control": "no-cache",
          "x-content-type-options": "nosniff"
        });
        return response.end(content);
      } catch (error) {
        console.error(`Unable to read dashboard asset ${asset.file}:`, error);
        return sendJson(response, 500, { error: "asset_unavailable" });
      }
    }

    return sendJson(response, 404, { error: "not_found" });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const server = createServer();
  server.listen(port, "127.0.0.1", () => {
    console.log(`Tier dashboard available at http://localhost:${port}`);
  });

  for (const signal of ["SIGTERM", "SIGINT"]) {
    process.once(signal, () => server.close(() => process.exit(0)));
  }
}

module.exports = { createServer };

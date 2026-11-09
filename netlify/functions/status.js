const services = [
  {
    id: "tier-1",
    name: "API de pedidos",
    tier: 1,
    port: 3001,
    urlEnv: "TIER_1_URL"
  },
  {
    id: "tier-2",
    name: "Notificações",
    tier: 2,
    port: 3002,
    urlEnv: "TIER_2_URL"
  },
  {
    id: "tier-3",
    name: "Analytics",
    tier: 3,
    port: 3003,
    urlEnv: "TIER_3_URL"
  }
];

function normalizeServiceUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("A URL deve usar HTTP ou HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("A URL não deve conter credenciais");
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

async function checkService(service) {
  const { urlEnv, ...publicService } = service;
  let url;

  try {
    const configuredUrl = process.env[urlEnv];
    if (!configuredUrl) {
      throw new Error("URL não configurada");
    }

    url = normalizeServiceUrl(configuredUrl);
    const response = await fetch(`${url}/healthz`, {
      signal: AbortSignal.timeout(3000)
    });

    return {
      ...publicService,
      url,
      online: response.ok,
      detail: response.ok ? "Saúde confirmada" : `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      ...publicService,
      ...(url ? { url } : {}),
      online: false,
      detail: error.message
    };
  }
}

exports.handler = async () => {
  const results = await Promise.all(services.map(checkService));

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify({
      checkedAt: new Date().toISOString(),
      services: results
    })
  };
};

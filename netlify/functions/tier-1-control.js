function jsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers
    },
    body: JSON.stringify(body)
  };
}

function isSameOrigin(headers) {
  const origin = headers.origin;
  const host = headers.host;

  if (!origin || !host) {
    return false;
  }

  try {
    return new URL(origin).host.toLowerCase() === host.toLowerCase();
  } catch {
    return false;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" }, { Allow: "POST" });
  }

  if (!isSameOrigin(event.headers || {})) {
    return jsonResponse(403, { error: "same_origin_required" });
  }

  const apiKey = process.env.RENDER_API_KEY;
  const serviceId = process.env.TIER_1_RENDER_SERVICE_ID;

  if (!apiKey || !serviceId) {
    return jsonResponse(503, {
      error: "render_control_not_configured",
      detail: "Configure RENDER_API_KEY e TIER_1_RENDER_SERVICE_ID nas variáveis de ambiente da Netlify."
    });
  }

  let payload;
  try {
    const requestBody = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : event.body;
    payload = JSON.parse(requestBody || "");
  } catch {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const action = payload?.action;
  if (action !== "suspend" && action !== "resume") {
    return jsonResponse(400, { error: "invalid_action" });
  }

  let response;
  try {
    response = await fetch(
      `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/${action}`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        signal: AbortSignal.timeout(8000)
      }
    );
  } catch {
    return jsonResponse(502, { error: "render_unreachable" });
  }

  if (!response.ok) {
    return jsonResponse(502, {
      error: "render_rejected_action",
      detail: `Render respondeu HTTP ${response.status}.`
    });
  }

  return jsonResponse(202, { accepted: true, action });
};

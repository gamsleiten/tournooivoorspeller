// Cloudflare Worker proxy for SportDB CORS
// Deploy this worker and paste its URL into the app as "SportDB proxy URL".
// The browser sends X-API-Key to this worker; the worker forwards it to SportDB.

export default {
  async fetch(request) {
    const apiKey = request.headers.get("X-API-Key") || "";
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing X-API-Key" }), {
        status: 400,
        headers: corsHeaders()
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const upstream = await fetch("https://api.sportdb.dev/api/flashscore/football", {
      headers: { "X-API-Key": apiKey }
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders(),
        "content-type": upstream.headers.get("content-type") || "application/json"
      }
    });
  }
};

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "X-API-Key,Content-Type"
  };
}

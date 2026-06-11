// Cloudflare Worker proxy for SportDB CORS.
// Put your SportDB API key below, deploy, and use the worker URL in the app.
const SPORTDB_API_KEY = "PASTE_YOUR_SPORTDB_KEY_HERE";

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const upstream = await fetch("https://api.sportdb.dev/api/flashscore/football", {
      headers: { "X-API-Key": SPORTDB_API_KEY }
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
    "access-control-allow-headers": "Content-Type"
  };
}

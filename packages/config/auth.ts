/**
 * API key authentication for the Ode web server.
 *
 * When ODE_API_KEY is set, every request to /api/* must supply the key as:
 *   - Authorization: Bearer <key>
 *   - X-API-Key: <key>
 *
 * Routes that are exempt from auth (Lark webhook is called by Lark's servers
 * and uses its own signature-based verification):
 *   /api/lark/event
 *   /api/lark-event
 */

const LARK_EXEMPT_PATHS = new Set(["/api/lark/event", "/api/lark-event"]);

function getConfiguredApiKey(): string {
  return process.env.ODE_API_KEY?.trim() ?? "";
}

export function isApiAuthEnabled(): boolean {
  return getConfiguredApiKey().length > 0;
}

function extractRequestApiKey(request: Request): string {
  // Authorization: Bearer <key>
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice("bearer ".length).trim();
  }

  // X-API-Key: <key>
  const apiKeyHeader = request.headers.get("x-api-key") ?? "";
  if (apiKeyHeader) {
    return apiKeyHeader.trim();
  }

  return "";
}

function isLarkExemptPath(pathname: string): boolean {
  return LARK_EXEMPT_PATHS.has(pathname);
}

/**
 * Returns a 401 Response if the request fails API key auth, or null if the
 * request is allowed to proceed.
 */
export function checkApiAuth(request: Request): Response | null {
  const url = new URL(request.url);

  // Only enforce on /api/* paths
  if (!url.pathname.startsWith("/api/")) {
    return null;
  }

  // Exempt paths (Lark webhook)
  if (isLarkExemptPath(url.pathname)) {
    return null;
  }

  // If no API key is configured, auth is disabled — allow all requests.
  const configuredKey = getConfiguredApiKey();
  if (!configuredKey) {
    return null;
  }

  const provided = extractRequestApiKey(request);
  if (!provided) {
    return new Response(
      JSON.stringify({ ok: false, error: "Missing API key. Supply it via Authorization: Bearer <key> or X-API-Key header." }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  // Constant-time comparison to prevent timing attacks
  if (!timingSafeEqual(provided, configuredKey)) {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid API key." }),
      { status: 401, headers: { "content-type": "application/json" } }
    );
  }

  return null;
}

/**
 * Simple constant-time string comparison.
 * Not cryptographic but prevents naive early-exit timing leaks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate to avoid length-based timing leak
    let dummy = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      dummy |= (a.charCodeAt(i) ?? 0) ^ (b.charCodeAt(i) ?? 0);
    }
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

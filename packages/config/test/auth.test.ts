import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { checkApiAuth, isApiAuthEnabled } from "../auth";

// Helper to build a Request pointed at an /api/* path
function apiRequest(
  path: string,
  headers: Record<string, string> = {},
  method = "GET"
): Request {
  return new Request(`http://localhost${path}`, { method, headers });
}

// Save and restore ODE_API_KEY around each test so tests don't bleed into each other
let savedKey: string | undefined;
beforeEach(() => {
  savedKey = process.env.ODE_API_KEY;
});
afterEach(() => {
  if (savedKey === undefined) {
    delete process.env.ODE_API_KEY;
  } else {
    process.env.ODE_API_KEY = savedKey;
  }
});

// ─── isApiAuthEnabled ────────────────────────────────────────────────────────

describe("isApiAuthEnabled", () => {
  it("returns false when ODE_API_KEY is not set", () => {
    delete process.env.ODE_API_KEY;
    expect(isApiAuthEnabled()).toBe(false);
  });

  it("returns false when ODE_API_KEY is an empty string", () => {
    process.env.ODE_API_KEY = "";
    expect(isApiAuthEnabled()).toBe(false);
  });

  it("returns false when ODE_API_KEY is only whitespace", () => {
    process.env.ODE_API_KEY = "   ";
    expect(isApiAuthEnabled()).toBe(false);
  });

  it("returns true when ODE_API_KEY has a value", () => {
    process.env.ODE_API_KEY = "secret-key";
    expect(isApiAuthEnabled()).toBe(true);
  });
});

// ─── checkApiAuth — auth disabled ────────────────────────────────────────────

describe("checkApiAuth — no ODE_API_KEY configured", () => {
  beforeEach(() => {
    delete process.env.ODE_API_KEY;
  });

  it("allows any /api/* request when auth is disabled", () => {
    expect(checkApiAuth(apiRequest("/api/config"))).toBeNull();
  });

  it("allows /api/sessions when auth is disabled", () => {
    expect(checkApiAuth(apiRequest("/api/sessions"))).toBeNull();
  });

  it("allows non-api paths when auth is disabled", () => {
    expect(checkApiAuth(apiRequest("/"))).toBeNull();
  });
});

// ─── checkApiAuth — non-API paths ────────────────────────────────────────────

describe("checkApiAuth — non-API paths are always allowed", () => {
  beforeEach(() => {
    process.env.ODE_API_KEY = "my-secret";
  });

  it("allows root path without key", () => {
    expect(checkApiAuth(apiRequest("/"))).toBeNull();
  });

  it("allows static asset paths without key", () => {
    expect(checkApiAuth(apiRequest("/assets/app.js"))).toBeNull();
  });
});

// ─── checkApiAuth — Lark exempt paths ────────────────────────────────────────

describe("checkApiAuth — Lark webhook paths are exempt", () => {
  beforeEach(() => {
    process.env.ODE_API_KEY = "my-secret";
  });

  it("allows /api/lark/event without a key", () => {
    expect(checkApiAuth(apiRequest("/api/lark/event", {}, "POST"))).toBeNull();
  });

  it("allows /api/lark-event without a key", () => {
    expect(checkApiAuth(apiRequest("/api/lark-event", {}, "POST"))).toBeNull();
  });
});

// ─── checkApiAuth — missing key ──────────────────────────────────────────────

describe("checkApiAuth — ODE_API_KEY set, no key in request", () => {
  beforeEach(() => {
    process.env.ODE_API_KEY = "my-secret";
  });

  it("returns 401 when no auth header is provided", async () => {
    const result = checkApiAuth(apiRequest("/api/config"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const body = await result!.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Missing API key");
  });

  it("returns 401 for /api/sessions without a key", async () => {
    const result = checkApiAuth(apiRequest("/api/sessions"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("returns 401 for POST /api/action without a key", async () => {
    const result = checkApiAuth(apiRequest("/api/action", {}, "POST"));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});

// ─── checkApiAuth — wrong key ────────────────────────────────────────────────

describe("checkApiAuth — ODE_API_KEY set, wrong key supplied", () => {
  beforeEach(() => {
    process.env.ODE_API_KEY = "correct-key";
  });

  it("returns 401 for wrong Bearer token", async () => {
    const result = checkApiAuth(apiRequest("/api/config", {
      authorization: "Bearer wrong-key",
    }));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
    const body = await result!.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Invalid API key");
  });

  it("returns 401 for wrong X-API-Key", async () => {
    const result = checkApiAuth(apiRequest("/api/config", {
      "x-api-key": "wrong-key",
    }));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("rejects a key that is a prefix of the correct key", async () => {
    const result = checkApiAuth(apiRequest("/api/config", {
      authorization: "Bearer correct-ke",
    }));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it("rejects a key that extends the correct key", async () => {
    const result = checkApiAuth(apiRequest("/api/config", {
      authorization: "Bearer correct-key-extra",
    }));
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});

// ─── checkApiAuth — correct key ──────────────────────────────────────────────

describe("checkApiAuth — ODE_API_KEY set, correct key supplied", () => {
  beforeEach(() => {
    process.env.ODE_API_KEY = "correct-key";
  });

  it("allows request with correct Bearer token", () => {
    const result = checkApiAuth(apiRequest("/api/config", {
      authorization: "Bearer correct-key",
    }));
    expect(result).toBeNull();
  });

  it("allows request with correct X-API-Key header", () => {
    const result = checkApiAuth(apiRequest("/api/config", {
      "x-api-key": "correct-key",
    }));
    expect(result).toBeNull();
  });

  it("allows request with Bearer token that has surrounding whitespace trimmed from env", () => {
    process.env.ODE_API_KEY = "  correct-key  ";
    const result = checkApiAuth(apiRequest("/api/config", {
      authorization: "Bearer correct-key",
    }));
    expect(result).toBeNull();
  });

  it("allows POST /api/action with correct key", () => {
    const result = checkApiAuth(apiRequest("/api/action", {
      "x-api-key": "correct-key",
    }, "POST"));
    expect(result).toBeNull();
  });

  it("is case-insensitive on the 'bearer' prefix", () => {
    const result = checkApiAuth(apiRequest("/api/config", {
      authorization: "BEARER correct-key",
    }));
    expect(result).toBeNull();
  });
});

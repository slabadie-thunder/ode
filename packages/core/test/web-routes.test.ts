import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { SessionEvent } from "@/config/local/redis";
import { createWebApp } from "@/core/web/app";
import { collapseTextDeltas } from "@/core/web/session-events";

// ─── API key auth integration ─────────────────────────────────────────────────

describe("API key authentication middleware", () => {
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

  it("passes through /api/* without restriction when ODE_API_KEY is not set", async () => {
    delete process.env.ODE_API_KEY;
    const app = createWebApp();
    const response = await app.handle(new Request("http://localhost/api/config"));
    // 200 or any non-401: auth is not blocking the request
    expect(response.status).not.toBe(401);
  });

  it("returns 401 on /api/config when ODE_API_KEY is set and no key is provided", async () => {
    process.env.ODE_API_KEY = "test-secret";
    const app = createWebApp();
    const response = await app.handle(new Request("http://localhost/api/config"));
    expect(response.status).toBe(401);
    const body = await response.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Missing API key");
  });

  it("returns 401 on /api/sessions when ODE_API_KEY is set and no key is provided", async () => {
    process.env.ODE_API_KEY = "test-secret";
    const app = createWebApp();
    const response = await app.handle(new Request("http://localhost/api/sessions"));
    expect(response.status).toBe(401);
  });

  it("returns 401 when wrong Bearer token is provided", async () => {
    process.env.ODE_API_KEY = "correct-secret";
    const app = createWebApp();
    const response = await app.handle(new Request("http://localhost/api/config", {
      headers: { authorization: "Bearer wrong-secret" },
    }));
    expect(response.status).toBe(401);
    const body = await response.json() as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toContain("Invalid API key");
  });

  it("returns 401 when wrong X-API-Key is provided", async () => {
    process.env.ODE_API_KEY = "correct-secret";
    const app = createWebApp();
    const response = await app.handle(new Request("http://localhost/api/config", {
      headers: { "x-api-key": "wrong-secret" },
    }));
    expect(response.status).toBe(401);
  });

  it("allows /api/config with correct Bearer token", async () => {
    process.env.ODE_API_KEY = "my-secret";
    const app = createWebApp();
    const response = await app.handle(new Request("http://localhost/api/config", {
      headers: { authorization: "Bearer my-secret" },
    }));
    expect(response.status).not.toBe(401);
  });

  it("allows /api/config with correct X-API-Key header", async () => {
    process.env.ODE_API_KEY = "my-secret";
    const app = createWebApp();
    const response = await app.handle(new Request("http://localhost/api/config", {
      headers: { "x-api-key": "my-secret" },
    }));
    expect(response.status).not.toBe(401);
  });

  it("does not block non-api paths even when ODE_API_KEY is set", async () => {
    process.env.ODE_API_KEY = "my-secret";
    const app = createWebApp();
    // Static redirect routes are not under /api/
    const response = await app.handle(new Request("http://localhost/local-setting"));
    expect(response.status).not.toBe(401);
  });

  it("allows POST /api/lark/event without a key (Lark webhook exempt)", async () => {
    process.env.ODE_API_KEY = "my-secret";
    const app = createWebApp();
    const response = await app.handle(new Request("http://localhost/api/lark/event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "url_verification", challenge: "abc" }),
    }));
    // Should not be 401 — Lark routes are exempt from key auth
    expect(response.status).not.toBe(401);
  });

  it("allows POST /api/lark-event without a key (legacy Lark webhook path)", async () => {
    process.env.ODE_API_KEY = "my-secret";
    const app = createWebApp();
    const response = await app.handle(new Request("http://localhost/api/lark-event", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "url_verification", challenge: "abc" }),
    }));
    expect(response.status).not.toBe(401);
  });
});

describe("web app routing", () => {
  // Ensure ODE_API_KEY is never set for these pre-auth tests so auth
  // middleware doesn't interfere with the expected status codes.
  let savedKey: string | undefined;
  beforeEach(() => { savedKey = process.env.ODE_API_KEY; delete process.env.ODE_API_KEY; });
  afterEach(() => { if (savedKey === undefined) { delete process.env.ODE_API_KEY; } else { process.env.ODE_API_KEY = savedKey; } });

  it("redirects /local-setting to root", async () => {
    const app = createWebApp();
    const response = await app.handle(new Request("http://localhost/local-setting"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/");
  });

  it("redirects /local-setting/* to root-relative path", async () => {
    const app = createWebApp();
    const response = await app.handle(new Request("http://localhost/local-setting/sessions/abc"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/sessions/abc");
  });

  it("returns 400 for workspace sync without workspaceId", async () => {
    const app = createWebApp();
    const response = await app.handle(new Request("http://localhost/api/slack-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(400);
    const payload = await response.json() as { ok: boolean; error?: string };
    expect(payload.ok).toBe(false);
    expect(payload.error).toBe("Missing workspaceId");
  });

  it("returns 400 for workspace discover without required credentials", async () => {
    const app = createWebApp();
    const response = await app.handle(new Request("http://localhost/api/slack-discover", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(400);
    const payload = await response.json() as { ok: boolean; error?: string };
    expect(payload.ok).toBe(false);
    expect(payload.error?.startsWith("Missing Slack")).toBe(true);
  });
});

describe("collapseTextDeltas", () => {
  it("keeps only latest text delta for each part id", () => {
    const base = {
      sessionId: "s1",
      channelId: "C1",
      threadId: "T1",
      agentProvider: "opencode",
    };
    const events = [
      {
        ...base,
        timestamp: 1,
        type: "message.part.updated",
        data: { properties: { part: { id: "p1", type: "text", text: "a" } } },
      },
      {
        ...base,
        timestamp: 2,
        type: "message.part.updated",
        data: { properties: { part: { id: "p1", type: "text", text: "ab" } } },
      },
      {
        ...base,
        timestamp: 3,
        type: "tool.started",
        data: { id: "t1" },
      },
      {
        ...base,
        timestamp: 4,
        type: "message.part.updated",
        data: { properties: { part: { id: "p2", type: "text", text: "x" } } },
      },
    ] as SessionEvent[];

    const collapsed = collapseTextDeltas(events);
    expect(collapsed).toHaveLength(3);
    expect(collapsed[0]?.timestamp).toBe(2);
    expect(collapsed[1]?.type).toBe("tool.started");
    expect(collapsed[2]?.timestamp).toBe(4);
  });
});

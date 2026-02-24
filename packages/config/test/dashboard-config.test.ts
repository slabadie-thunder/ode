import { describe, expect, it } from "bun:test";
import { type DashboardConfig, redactDashboardConfig } from "../dashboard-config";

// Minimal workspace factory
function makeWorkspace(
  overrides: Partial<DashboardConfig["workspaces"][number]> = {}
): DashboardConfig["workspaces"][number] {
  return {
    id: "ws-1",
    type: "slack",
    name: "Test Workspace",
    domain: "test.slack.com",
    status: "active",
    channels: 2,
    members: 5,
    lastSync: "2025-01-01T00:00:00.000Z",
    channelDetails: [],
    ...overrides,
  };
}

// Full populated config with all credential fields set
function makeConfig(
  workspaces: DashboardConfig["workspaces"] = []
): DashboardConfig {
  return {
    completeOnboarding: true,
    user: {
      name: "Alice",
      email: "alice@example.com",
      gitStrategy: "worktree",
      defaultStatusMessageFormat: "medium",
      statusMessageFrequencyMs: 2000,
    },
    updates: { autoUpgrade: true },
    agents: {
      opencode: { enabled: true, models: [] },
      claudecode: { enabled: true },
      codex: { enabled: true, models: [] },
      kimi: { enabled: true },
      kiro: { enabled: true },
      kilo: { enabled: true, models: [] },
      qwen: { enabled: true },
      goose: { enabled: true },
      gemini: { enabled: true },
    },
    workspaces,
  };
}

describe("redactDashboardConfig", () => {
  // ─── Non-workspace fields are preserved ────────────────────────────────────

  it("preserves completeOnboarding flag", () => {
    const config = makeConfig();
    expect(redactDashboardConfig(config).completeOnboarding).toBe(true);
  });

  it("preserves user settings unchanged", () => {
    const config = makeConfig();
    const redacted = redactDashboardConfig(config);
    expect(redacted.user).toEqual(config.user);
  });

  it("preserves updates settings unchanged", () => {
    const config = makeConfig();
    expect(redactDashboardConfig(config).updates).toEqual(config.updates);
  });

  it("preserves agents config unchanged", () => {
    const config = makeConfig();
    expect(redactDashboardConfig(config).agents).toEqual(config.agents);
  });

  it("works with an empty workspaces array", () => {
    const config = makeConfig([]);
    expect(redactDashboardConfig(config).workspaces).toEqual([]);
  });

  // ─── Slack token redaction ─────────────────────────────────────────────────

  it("redacts slackAppToken", () => {
    const config = makeConfig([
      makeWorkspace({ slackAppToken: "xapp-real-token", slackBotToken: "xoxb-real-token" }),
    ]);
    const redacted = redactDashboardConfig(config);
    expect(redacted.workspaces[0]?.slackAppToken).toBe("***");
  });

  it("redacts slackBotToken", () => {
    const config = makeConfig([
      makeWorkspace({ slackAppToken: "xapp-real-token", slackBotToken: "xoxb-real-token" }),
    ]);
    const redacted = redactDashboardConfig(config);
    expect(redacted.workspaces[0]?.slackBotToken).toBe("***");
  });

  it("leaves slackAppToken undefined when it was not set", () => {
    const config = makeConfig([makeWorkspace({ slackAppToken: undefined })]);
    const redacted = redactDashboardConfig(config);
    expect(redacted.workspaces[0]?.slackAppToken).toBeUndefined();
  });

  it("leaves slackBotToken undefined when it was not set", () => {
    const config = makeConfig([makeWorkspace({ slackBotToken: undefined })]);
    const redacted = redactDashboardConfig(config);
    expect(redacted.workspaces[0]?.slackBotToken).toBeUndefined();
  });

  // ─── Discord token redaction ───────────────────────────────────────────────

  it("redacts discordBotToken", () => {
    const config = makeConfig([
      makeWorkspace({ type: "discord", discordBotToken: "real-discord-token" }),
    ]);
    const redacted = redactDashboardConfig(config);
    expect(redacted.workspaces[0]?.discordBotToken).toBe("***");
  });

  it("leaves discordBotToken undefined when it was not set", () => {
    const config = makeConfig([makeWorkspace({ discordBotToken: undefined })]);
    expect(redactDashboardConfig(config).workspaces[0]?.discordBotToken).toBeUndefined();
  });

  // ─── Lark credential redaction ─────────────────────────────────────────────

  it("redacts larkAppKey", () => {
    const config = makeConfig([
      makeWorkspace({ type: "lark", larkAppKey: "real-app-key", larkAppSecret: "real-secret" }),
    ]);
    const redacted = redactDashboardConfig(config);
    expect(redacted.workspaces[0]?.larkAppKey).toBe("***");
  });

  it("redacts larkAppId", () => {
    const config = makeConfig([
      makeWorkspace({ type: "lark", larkAppId: "real-app-id", larkAppSecret: "real-secret" }),
    ]);
    const redacted = redactDashboardConfig(config);
    expect(redacted.workspaces[0]?.larkAppId).toBe("***");
  });

  it("redacts larkAppSecret", () => {
    const config = makeConfig([
      makeWorkspace({ type: "lark", larkAppKey: "real-app-key", larkAppSecret: "real-secret" }),
    ]);
    const redacted = redactDashboardConfig(config);
    expect(redacted.workspaces[0]?.larkAppSecret).toBe("***");
  });

  it("leaves Lark fields undefined when they were not set", () => {
    const config = makeConfig([
      makeWorkspace({ larkAppKey: undefined, larkAppId: undefined, larkAppSecret: undefined }),
    ]);
    const redacted = redactDashboardConfig(config).workspaces[0]!;
    expect(redacted.larkAppKey).toBeUndefined();
    expect(redacted.larkAppId).toBeUndefined();
    expect(redacted.larkAppSecret).toBeUndefined();
  });

  // ─── Non-sensitive workspace fields are preserved ──────────────────────────

  it("preserves workspace id, name, type, domain, status", () => {
    const workspace = makeWorkspace({
      id: "ws-42",
      name: "My Team",
      type: "slack",
      domain: "myteam.slack.com",
      status: "paused",
    });
    const config = makeConfig([workspace]);
    const redacted = redactDashboardConfig(config).workspaces[0]!;
    expect(redacted.id).toBe("ws-42");
    expect(redacted.name).toBe("My Team");
    expect(redacted.type).toBe("slack");
    expect(redacted.domain).toBe("myteam.slack.com");
    expect(redacted.status).toBe("paused");
  });

  it("preserves channelDetails unchanged", () => {
    const channelDetails: DashboardConfig["workspaces"][number]["channelDetails"] = [
      {
        id: "C123",
        name: "#general",
        agentProvider: "claudecode",
        model: "",
        workingDirectory: "/repo",
        baseBranch: "main",
      },
    ];
    const config = makeConfig([makeWorkspace({ channelDetails })]);
    const redacted = redactDashboardConfig(config);
    expect(redacted.workspaces[0]?.channelDetails).toEqual(channelDetails);
  });

  // ─── Does not mutate the original ─────────────────────────────────────────

  it("does not mutate the original config object", () => {
    const workspace = makeWorkspace({ slackAppToken: "xapp-original", slackBotToken: "xoxb-original" });
    const config = makeConfig([workspace]);
    redactDashboardConfig(config);
    // Original must remain unchanged
    expect(config.workspaces[0]?.slackAppToken).toBe("xapp-original");
    expect(config.workspaces[0]?.slackBotToken).toBe("xoxb-original");
  });

  // ─── Multiple workspaces ───────────────────────────────────────────────────

  it("redacts all workspaces in a multi-workspace config", () => {
    const config = makeConfig([
      makeWorkspace({ id: "ws-1", slackAppToken: "token-1", slackBotToken: "bot-1" }),
      makeWorkspace({ id: "ws-2", type: "discord", discordBotToken: "discord-token" }),
      makeWorkspace({
        id: "ws-3",
        type: "lark",
        larkAppKey: "lark-key",
        larkAppSecret: "lark-secret",
      }),
    ]);
    const redacted = redactDashboardConfig(config);
    expect(redacted.workspaces[0]?.slackAppToken).toBe("***");
    expect(redacted.workspaces[0]?.slackBotToken).toBe("***");
    expect(redacted.workspaces[1]?.discordBotToken).toBe("***");
    expect(redacted.workspaces[2]?.larkAppKey).toBe("***");
    expect(redacted.workspaces[2]?.larkAppSecret).toBe("***");
  });
});

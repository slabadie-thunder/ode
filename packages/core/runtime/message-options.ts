import { DEFAULT_CODEX_MODEL, getChannelModel, getChannelOpenCodeProfile } from "@/config";
import type { OpenCodeOptions } from "@/agents";

type ProviderId = "opencode" | "claudecode" | "codex" | "kimi" | "kiro" | "kilo" | "qwen" | "goose" | "gemini";

function toKiloModel(modelValue: string | null | undefined): OpenCodeOptions["model"] | undefined {
  const trimmed = modelValue?.trim();
  if (!trimmed) return undefined;
  const [providerID = "kilo", ...rest] = trimmed.split("/");
  if (rest.length === 0) {
    return { providerID: "kilo", modelID: trimmed };
  }
  return { providerID, modelID: rest.join("/") };
}

export function buildMessageOptions(params: {
  text: string;
  channelId: string;
  providerId: ProviderId;
}): OpenCodeOptions | undefined {
  const { text, channelId, providerId } = params;
  const normalizedText = text.trimStart().toLowerCase();

  // "plan" prefix in the message overrides the channel profile; otherwise fall
  // back to the configured OpenCode profile for this channel (opencode only).
  const planPrefix = /^plan\b/.test(normalizedText);
  const channelProfile = providerId === "opencode"
    ? (getChannelOpenCodeProfile(channelId) || undefined)
    : undefined;
  const agent = planPrefix ? "plan" : channelProfile;

  const channelModel = getChannelModel(channelId)?.trim();
  const codexModel = providerId === "codex"
    ? (channelModel && channelModel.length > 0 ? channelModel : DEFAULT_CODEX_MODEL)
    : undefined;
  const kiloModel = providerId === "kilo" ? toKiloModel(channelModel) : undefined;

  if (!agent && !codexModel && !kiloModel) {
    return undefined;
  }

  return {
    ...(agent ? { agent } : {}),
    ...(codexModel ? { model: { providerID: "openai", modelID: codexModel } } : {}),
    ...(kiloModel ? { model: kiloModel } : {}),
  };
}

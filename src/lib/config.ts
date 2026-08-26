import "server-only";

import os from "node:os";
import path from "node:path";

function csv(value: string | undefined): string[] {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

export const serverConfig = Object.freeze({
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5-20251001",
  },
  paths: {
    home: path.resolve(process.env.VALLEOS_HOME_PATH ?? os.homedir()),
    vault: process.env.OBSIDIAN_VAULT_PATH
      ? path.resolve(process.env.OBSIDIAN_VAULT_PATH)
      : "",
  },
  locale: process.env.VALLEOS_LOCALE ?? "es-MX",
  timezone: process.env.VALLEOS_TIMEZONE ?? "America/Mexico_City",
  whatsapp: {
    allowedSenders: csv(process.env.WHATSAPP_ALLOWED_SENDERS),
    groupName: process.env.WHATSAPP_SHADOW_GROUP ?? "Shadow",
  },
});

export function requireAnthropicApiKey(): string {
  if (!serverConfig.anthropic.apiKey) {
    throw new Error("ANTHROPIC_API_KEY no está configurada.");
  }
  return serverConfig.anthropic.apiKey;
}

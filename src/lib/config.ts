import "server-only";

import os from "node:os";
import path from "node:path";

function csv(value: string | undefined): string[] {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

export type ModelEffort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: readonly ModelEffort[] = ["low", "medium", "high", "xhigh", "max"];

function effort(value: string | undefined, fallback: ModelEffort): ModelEffort {
  return EFFORTS.find((level) => level === value) ?? fallback;
}

export const serverConfig = Object.freeze({
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5",
    /** Esfuerzo del chat de Shadow. Las tareas internas usan `low`. */
    effort: effort(process.env.ANTHROPIC_EFFORT, "medium"),
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

/** Modelos anteriores a `effort` (Haiku 4.5, Sonnet 4.5, 3.x…) lo rechazan con un 400. */
const PRE_EFFORT_MODEL = /claude-(3|haiku-4|sonnet-4-5|sonnet-4-0|sonnet-4-2|opus-4-0|opus-4-1)/;

/**
 * `output_config` con el esfuerzo indicado si el modelo configurado lo admite.
 * Así ANTHROPIC_MODEL puede apuntar a un modelo viejo sin romper peticiones.
 */
export function modelOutputConfig(level: ModelEffort): { effort?: ModelEffort } | undefined;
export function modelOutputConfig<T extends object>(level: ModelEffort, extra: T): T & { effort?: ModelEffort };
export function modelOutputConfig(level: ModelEffort, extra?: object): object | undefined {
  const supportsEffort = !PRE_EFFORT_MODEL.test(serverConfig.anthropic.model);
  if (!supportsEffort) return extra;
  return { ...extra, effort: level };
}

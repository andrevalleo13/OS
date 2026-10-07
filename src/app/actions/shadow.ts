"use server";

import { z } from "zod";
import { getConversationMessages, importConversationMessages } from "@/features/shadow/conversations";
import type { ShadowResult } from "@/features/shadow/protocol";
import { getNextProactiveInsight, runProactiveCycle } from "@/features/shadow/proactivity";
import { runShadowTurn } from "@/features/shadow/turn";
import { errorMessage } from "@/lib/errors";

export type { ChatMessage } from "@/features/shadow/orchestrator";

export async function askShadow(rawInput: unknown): Promise<ShadowResult> {
  return runShadowTurn(rawInput);
}

export async function getShadowConversation(conversationKey = "dashboard:primary") {
  try {
    return { success: true as const, messages: await getConversationMessages(conversationKey) };
  } catch (error) {
    console.error(`Shadow history load failed: ${errorMessage(error)}`);
    return { success: false as const, messages: [] };
  }
}

export async function importShadowConversation(rawInput: unknown) {
  const input = z.object({
    conversationKey: z.string().trim().min(1).max(240),
    channel: z.enum(["dashboard", "whatsapp", "system"]).default("dashboard"),
    messages: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1).max(20_000),
      mood: z.string().trim().max(40).optional(),
      widget: z.string().trim().max(40).optional(),
    })).max(80),
  }).parse(rawInput);

  try {
    const count = await importConversationMessages(input.conversationKey, input.channel, input.messages);
    return { success: true as const, count };
  } catch (error) {
    console.error(`Shadow history import failed: ${errorMessage(error)}`);
    return { success: false as const, count: 0 };
  }
}

export async function getProactiveInsight() {
  try {
    await runProactiveCycle();
    const insight = await getNextProactiveInsight();
    if (!insight) return { success: true, text: "", mood: "neutral", widget: "none", shouldNotify: false };
    return { success: true, text: insight.body, mood: insight.urgency >= 80 ? "warning" : "info", widget: "none", shouldNotify: true };
  } catch (error) {
    console.error(`Shadow proactive insight failed: ${errorMessage(error)}`);
    return { success: false, text: "", mood: "neutral", widget: "none", shouldNotify: false };
  }
}

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { serverConfig } from "@/lib/config";
import { errorMessage } from "@/lib/errors";
import type { PendingShadowAction } from "./file-actions";
import { executeShadowTool, SHADOW_TOOLS } from "./tools";
import { cleanShadowMetadata } from "./response";

const anthropic = new Anthropic({ apiKey: serverConfig.anthropic.apiKey });
const MAX_TOOL_STEPS = 6;
const messageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20_000) });
type Mood = "neutral" | "success" | "warning" | "info" | "urgent";
type Widget = "agenda" | "stats" | "none";

export type ChatMessage = z.infer<typeof messageSchema>;

export type ShadowResult = {
  success: boolean;
  text: string;
  mood: Mood;
  widget: Widget;
  pendingAction?: PendingShadowAction;
};

function safeHistory(input: unknown): MessageParam[] {
  const parsed = z.array(messageSchema).min(1).max(80).parse(input);
  return parsed.slice(-30).map((message) => ({ ...message, content: message.content.slice(0, 12_000) }));
}

export async function runShadowConversation(
  system: string,
  history: unknown,
  context: { conversationId?: string } = {},
): Promise<ShadowResult> {
  if (!serverConfig.anthropic.apiKey) {
    return { success: false, text: "Falta configurar ANTHROPIC_API_KEY.", mood: "urgent", widget: "none" };
  }

  try {
    const messages = safeHistory(history);
    let pendingAction: PendingShadowAction | undefined;

    for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
      const response = await anthropic.messages.create({
        model: serverConfig.anthropic.model,
        max_tokens: 1_024,
        system,
        tools: SHADOW_TOOLS,
        messages,
      });

      const toolUses = response.content.filter((block) => block.type === "tool_use");
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
        return { success: true, ...cleanShadowMetadata(text || "Listo."), pendingAction };
      }

      const toolResults: ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        const result = await executeShadowTool(toolUse, context);
        pendingAction = result.pendingAction ?? pendingAction;
        toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: result.content.slice(0, 10_000) });
      }
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }

    return { success: false, text: "Detuve la operación porque alcanzó el límite seguro de pasos.", mood: "warning", widget: "none", pendingAction };
  } catch (error) {
    console.error(`Shadow orchestration failed: ${errorMessage(error)}`);
    return { success: false, text: "Shadow no pudo completar la solicitud.", mood: "urgent", widget: "none" };
  }
}

import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, TextBlockParam, ToolResultBlockParam } from "@anthropic-ai/sdk/resources/messages";
import { z } from "zod";
import { modelOutputConfig, serverConfig } from "@/lib/config";
import { errorMessage } from "@/lib/errors";
import type { PendingShadowAction } from "./file-actions";
import { SHADOW_FAILURE, type ShadowResult, type ShadowStreamEvent } from "./protocol";
import { executeShadowTool, SHADOW_TOOLS } from "./tools";
import { cleanShadowMetadata, MetadataStripper } from "./response";
import { mergeSources, sourceFromToolUse, toolStepLabel, type ShadowSource } from "./sources";

export type { ShadowResult } from "./protocol";

const anthropic = new Anthropic({ apiKey: serverConfig.anthropic.apiKey });
const MAX_TOOL_STEPS = 6;
/** El pensamiento adaptativo cuenta dentro de este tope; con streaming no hay riesgo de timeout. */
const MAX_TOKENS = 16_000;
const messageSchema = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20_000) });

export type ChatMessage = z.infer<typeof messageSchema>;

/**
 * El prompt va en dos bloques para que la caché funcione: `instructions` es
 * idéntico en cada petición y lleva el punto de caché (junto con las
 * herramientas, que se renderizan antes); `context` cambia en cada mensaje y
 * va después, fuera del prefijo cacheado.
 */
export type ShadowPrompt = { instructions: string; context: string };

export type ShadowRunHooks = {
  emit?: (event: ShadowStreamEvent) => void;
  signal?: AbortSignal;
};

function safeHistory(input: unknown): MessageParam[] {
  const parsed = z.array(messageSchema).min(1).max(80).parse(input);
  return parsed.slice(-30).map((message) => ({ ...message, content: message.content.slice(0, 12_000) }));
}

function systemBlocks(prompt: ShadowPrompt): TextBlockParam[] {
  return [
    { type: "text", text: prompt.instructions, cache_control: { type: "ephemeral" } },
    { type: "text", text: prompt.context },
  ];
}

export async function runShadowConversation(
  prompt: ShadowPrompt,
  history: unknown,
  context: { conversationId?: string } = {},
  hooks: ShadowRunHooks = {},
): Promise<ShadowResult> {
  if (!serverConfig.anthropic.apiKey) {
    return { success: false, text: "Falta configurar ANTHROPIC_API_KEY.", mood: "urgent", widget: "none" };
  }
  const emit = hooks.emit ?? (() => {});

  try {
    const messages = safeHistory(history);
    const system = systemBlocks(prompt);
    let pendingAction: PendingShadowAction | undefined;
    const sources: ShadowSource[] = [];

    for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
      const stripper = new MetadataStripper();
      let streamedText = false;
      const stream = anthropic.messages.stream(
        {
          model: serverConfig.anthropic.model,
          max_tokens: MAX_TOKENS,
          system,
          tools: SHADOW_TOOLS,
          messages,
          // Segundo punto de caché automático sobre el historial: dentro del
          // bucle de herramientas, cada paso reutiliza el anterior.
          cache_control: { type: "ephemeral" },
          output_config: modelOutputConfig(serverConfig.anthropic.effort),
        },
        { signal: hooks.signal },
      );
      stream.on("text", (delta) => {
        const visible = stripper.push(delta);
        if (!visible) return;
        streamedText = true;
        emit({ type: "text", delta: visible });
      });
      const response = await stream.finalMessage();
      const tail = stripper.flush();
      if (tail) emit({ type: "text", delta: tail });

      if (response.stop_reason === "refusal") {
        return { success: false, text: "Eso no puedo hacerlo. Si lo reformulas, lo intento de otra forma.", mood: "warning", widget: "none", pendingAction, sources: mergeSources(sources) };
      }

      const toolUses = response.content.filter((block) => block.type === "tool_use");
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
        const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n");
        return { success: true, ...cleanShadowMetadata(text || "Listo."), pendingAction, sources: mergeSources(sources) };
      }

      // El texto antes de una herramienta es un preámbulo; la respuesta real viene después.
      if (streamedText) emit({ type: "reset" });

      const toolResults: ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        const source = sourceFromToolUse(toolUse.name, toolUse.input);
        if (source) sources.push(source);
        const label = toolStepLabel(toolUse.name, toolUse.input);
        if (label) emit({ type: "step", step: { id: toolUse.id, label } });
        const result = await executeShadowTool(toolUse, context);
        if (label) emit({ type: "step_done", id: toolUse.id, ok: !result.failed });
        pendingAction = result.pendingAction ?? pendingAction;
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.content.slice(0, 10_000),
          ...(result.failed ? { is_error: true } : {}),
        });
      }
      // El contenido completo (incluidos los bloques de pensamiento) vuelve intacto.
      messages.push({ role: "assistant", content: response.content });
      messages.push({ role: "user", content: toolResults });
    }

    return { success: false, text: "Detuve la operación porque alcanzó el límite seguro de pasos.", mood: "warning", widget: "none", pendingAction, sources: mergeSources(sources) };
  } catch (error) {
    if (hooks.signal?.aborted) return { ...SHADOW_FAILURE, text: "Solicitud cancelada." };
    console.error(`Shadow orchestration failed: ${errorMessage(error)}`);
    return SHADOW_FAILURE;
  }
}

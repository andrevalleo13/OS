import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShadowStreamEvent } from "./protocol";

type FakeTurn = { deltas: string[]; message: Record<string, unknown> };

const { turns, requests, executeShadowTool } = vi.hoisted(() => ({
  turns: [] as FakeTurn[],
  requests: [] as Array<Record<string, unknown>>,
  executeShadowTool: vi.fn(async () => ({ content: "ok" })),
}));

vi.mock("@/lib/config", () => ({
  serverConfig: { anthropic: { apiKey: "test", model: "claude-haiku-5-5", effort: "medium" } },
  modelOutputConfig: (level: string, extra?: object) => ({ ...extra, effort: level }),
}));

vi.mock("./tools", () => ({ SHADOW_TOOLS: [], executeShadowTool }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      stream: (params: Record<string, unknown>) => {
        // Copia: el orquestador sigue mutando el arreglo de mensajes.
        requests.push({ ...params, messages: [...(params.messages as unknown[])] });
        const turn = turns.shift()!;
        let onText: (delta: string) => void = () => {};
        return {
          on(_event: "text", listener: (delta: string) => void) {
            onText = listener;
            return this;
          },
          async finalMessage() {
            turn.deltas.forEach((delta) => onText(delta));
            return turn.message;
          },
        };
      },
    };
  },
}));

const { runShadowConversation } = await import("./orchestrator");

const prompt = { instructions: "fijas", context: "cambia" };
const history = [{ role: "user", content: "¿Qué tengo mañana?" }];

describe("runShadowConversation en streaming", () => {
  beforeEach(() => {
    turns.length = 0;
    requests.length = 0;
    executeShadowTool.mockClear();
  });

  it("narra pasos reales, descarta el preámbulo y oculta los metadatos", async () => {
    const thinking = { type: "thinking", thinking: "", signature: "sig" };
    turns.push(
      {
        deltas: ["Déjame revisar."],
        message: {
          stop_reason: "tool_use",
          content: [
            thinking,
            { type: "text", text: "Déjame revisar." },
            { type: "tool_use", id: "t1", name: "read_obsidian_note", input: { filename: "Personas/Diego.md" } },
            { type: "tool_use", id: "t2", name: "remember_personal_context", input: {} },
          ],
        },
      },
      {
        deltas: ["Mañana ves a ", "Diego.<mo", "od>success</mood><widget>none</widget>"],
        message: {
          stop_reason: "end_turn",
          content: [{ type: "text", text: "Mañana ves a Diego.<mood>success</mood><widget>none</widget>" }],
        },
      },
    );

    const events: ShadowStreamEvent[] = [];
    const result = await runShadowConversation(prompt, history, {}, { emit: (event) => events.push(event) });

    expect(result).toMatchObject({ success: true, text: "Mañana ves a Diego.", mood: "success", widget: "none" });
    expect(result.sources?.map((source) => source.label)).toEqual(["Diego"]);
    expect(events).toEqual([
      { type: "text", delta: "Déjame revisar." },
      { type: "reset" },
      { type: "step", step: { id: "t1", label: "Leyendo Diego", tool: "read_obsidian_note" } },
      { type: "step_done", id: "t1", ok: true },
      { type: "text", delta: "Mañana ves a " },
      { type: "text", delta: "Diego." },
    ]);
    expect(executeShadowTool).toHaveBeenCalledTimes(2);

    // Caché: instrucciones fijas con punto de caché, contexto variable después.
    expect(requests[0].system).toEqual([
      { type: "text", text: "fijas", cache_control: { type: "ephemeral" } },
      { type: "text", text: "cambia" },
    ]);
    expect(requests[0]).toMatchObject({ cache_control: { type: "ephemeral" }, output_config: { effort: "medium" } });
    expect(requests[0]).not.toHaveProperty("temperature");

    // El turno con herramientas vuelve completo, pensamiento incluido.
    const followUp = requests[1].messages as Array<{ role: string; content: unknown }>;
    expect(followUp.at(-2)?.content).toContainEqual(thinking);
    expect(followUp.at(-1)?.content).toHaveLength(2);
  });

  it("maneja un rechazo sin leer el contenido", async () => {
    turns.push({ deltas: [], message: { stop_reason: "refusal", content: [] } });
    const result = await runShadowConversation(prompt, history);
    expect(result).toMatchObject({ success: false, mood: "warning" });
  });

  it("marca como error una herramienta que falla", async () => {
    executeShadowTool.mockResolvedValueOnce({ content: "falló", failed: true } as never);
    turns.push(
      { deltas: [], message: { stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "add_expense", input: {} }] } },
      { deltas: ["Listo"], message: { stop_reason: "end_turn", content: [{ type: "text", text: "Listo" }] } },
    );
    const events: ShadowStreamEvent[] = [];
    await runShadowConversation(prompt, history, {}, { emit: (event) => events.push(event) });
    expect(events).toContainEqual({ type: "step_done", id: "t1", ok: false });
    const toolResult = (requests[1].messages as Array<{ content: Array<Record<string, unknown>> }>).at(-1)?.content[0];
    expect(toolResult).toMatchObject({ type: "tool_result", tool_use_id: "t1", is_error: true });
  });
});

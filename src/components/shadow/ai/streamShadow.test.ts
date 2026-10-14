import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShadowStreamEvent } from "@/features/shadow/protocol";
import { createNdjsonParser, streamShadow } from "./streamShadow";

describe("createNdjsonParser", () => {
  it("reconstruye eventos partidos entre fragmentos e ignora líneas corruptas", () => {
    const events: ShadowStreamEvent[] = [];
    const parser = createNdjsonParser((event) => events.push(event));
    parser.push('{"type":"step","step":{"id":"context","label":"Leyendo"}}\n{"type":"te');
    parser.push('xt","delta":"Hola"}\nno es json\n');
    parser.push('{"type":"reset"}');
    parser.end();
    expect(events).toEqual([
      { type: "step", step: { id: "context", label: "Leyendo" } },
      { type: "text", delta: "Hola" },
      { type: "reset" },
    ]);
  });
});

describe("streamShadow", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envía la nota abierta y narra los pasos hasta el resultado", async () => {
    const result = { success: true, text: "Listo", mood: "success", widget: "none" };
    const body = [
      { type: "step", step: { id: "t1", label: "Escribiendo en el diario", tool: "append_to_daily_note" } },
      { type: "step_done", id: "t1", ok: true },
      { type: "done", result },
    ].map((event) => JSON.stringify(event)).join("\n");
    const requests: RequestInit[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: unknown, init: RequestInit = {}) => {
      requests.push(init);
      return new Response(body);
    }));

    const steps: string[] = [];
    const output = await streamShadow(
      { message: "Pásalo al diario", conversationKey: "vault", notePath: "100 - Proyectos/Cord.md" },
      { onStep: (step) => steps.push(step.tool ?? step.id), onStepDone: (id) => steps.push(`${id}:done`) },
    );

    expect(output).toEqual(result);
    expect(steps).toEqual(["append_to_daily_note", "t1:done"]);
    expect(JSON.parse(String(requests[0]?.body))).toEqual({
      channel: "dashboard",
      message: "Pásalo al diario",
      conversationKey: "vault",
      notePath: "100 - Proyectos/Cord.md",
    });
  });
});

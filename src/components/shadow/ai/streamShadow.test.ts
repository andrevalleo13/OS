import { describe, expect, it } from "vitest";
import type { ShadowStreamEvent } from "@/features/shadow/protocol";
import { createNdjsonParser } from "./streamShadow";

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

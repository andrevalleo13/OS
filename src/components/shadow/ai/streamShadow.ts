import type { ShadowResult, ShadowStep, ShadowStreamEvent } from "@/features/shadow/protocol";

export type ShadowStreamHandlers = {
  onStep?: (step: ShadowStep) => void;
  onStepDone?: (id: string, ok: boolean) => void;
  /** Texto acumulado desde el último evento, agrupado por cuadro de animación. */
  onText?: (delta: string) => void;
  onReset?: () => void;
};

type ShadowTurnInput = { message: string; conversationKey: string; channel?: "dashboard" | "whatsapp" | "system" };

/** Parte un flujo NDJSON en eventos, tolerando líneas cortadas entre fragmentos. */
export function createNdjsonParser(onEvent: (event: ShadowStreamEvent) => void) {
  let buffer = "";
  const emitLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      onEvent(JSON.parse(trimmed) as ShadowStreamEvent);
    } catch {
      // Una línea corrupta no debe tumbar la respuesta completa.
    }
  };
  return {
    push(chunk: string) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      lines.forEach(emitLine);
    },
    end() {
      emitLine(buffer);
      buffer = "";
    },
  };
}

/**
 * Pide un turno a Shadow y narra el progreso real. Resuelve con el resultado
 * final; lanza si la conexión falla antes de recibirlo.
 */
export async function streamShadow(input: ShadowTurnInput, handlers: ShadowStreamHandlers = {}): Promise<ShadowResult> {
  const response = await fetch("/api/shadow/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ channel: "dashboard", ...input }),
  });
  if (!response.ok || !response.body) throw new Error(`Shadow respondió ${response.status}`);

  let pendingText = "";
  let frame: number | null = null;
  const flushText = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    if (!pendingText) return;
    const delta = pendingText;
    pendingText = "";
    handlers.onText?.(delta);
  };

  let result: ShadowResult | null = null;
  const parser = createNdjsonParser((event) => {
    if (event.type === "text") {
      pendingText += event.delta;
      frame ??= requestAnimationFrame(flushText);
      return;
    }
    // Cualquier otro evento respeta el orden: primero sale el texto pendiente.
    flushText();
    if (event.type === "step") handlers.onStep?.(event.step);
    else if (event.type === "step_done") handlers.onStepDone?.(event.id, event.ok);
    else if (event.type === "reset") handlers.onReset?.();
    else if (event.type === "done") result = event.result;
  });

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.push(value);
  }
  parser.end();
  flushText();

  if (!result) throw new Error("La conexión con Shadow se cortó antes de terminar.");
  return result;
}

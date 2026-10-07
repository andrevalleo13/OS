import { rejectNonLocalRequest } from "@/lib/local-request";
import { errorMessage } from "@/lib/errors";
import { SHADOW_FAILURE, type ShadowStreamEvent } from "@/features/shadow/protocol";
import { runShadowTurn } from "@/features/shadow/turn";

export const dynamic = "force-dynamic";

/**
 * Un turno de Shadow en vivo. Responde NDJSON: una línea por evento (pasos
 * reales, fragmentos de texto) y una línea final `done` con el resultado.
 */
export async function POST(request: Request) {
  const rejection = rejectNonLocalRequest(request);
  if (rejection) return rejection;

  const body: unknown = await request.json().catch(() => null);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: ShadowStreamEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // El cliente se fue; el turno termina y se guarda igual.
          open = false;
        }
      };
      try {
        // Sin `signal` a propósito: si cierras la pestaña, el turno termina y
        // queda en el historial en lugar de dejar tu mensaje sin respuesta.
        const result = await runShadowTurn(body, { emit: send });
        send({ type: "done", result });
      } catch (error) {
        console.error(`Shadow stream failed: ${errorMessage(error)}`);
        send({ type: "done", result: SHADOW_FAILURE });
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

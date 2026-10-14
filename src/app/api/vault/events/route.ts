import { rejectNonLocalRequest } from "@/lib/local-request";
import { subscribeVaultChanges } from "@/features/vault/watch";

export const dynamic = "force-dynamic";

/** Server-Sent Events con los archivos de la bóveda que cambiaron en disco. */
export async function GET(request: Request) {
  const rejection = rejectNonLocalRequest(request);
  if (rejection) return rejection;

  const encoder = new TextEncoder();
  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      let unsubscribe: () => void;
      try {
        unsubscribe = await subscribeVaultChanges((paths) => send(`event: change\ndata: ${JSON.stringify({ paths })}\n\n`));
      } catch {
        send(`event: unavailable\ndata: {}\n\n`);
        controller.close();
        return;
      }
      const heartbeat = setInterval(() => send(`: ping\n\n`), 25_000);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // ya cerrado
        }
      });
      send(`event: ready\ndata: {}\n\n`);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

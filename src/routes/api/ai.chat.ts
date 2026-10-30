import { createFileRoute } from "@tanstack/react-router";
import { ALLOWED_MODELS, OLLAMA_URL } from "@/lib/ollama.server";

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { model?: string; messages?: unknown[] } | null;
        if (!body?.model || !ALLOWED_MODELS.includes(body.model) || !Array.isArray(body.messages)) {
          return new Response("ভুল অনুরোধ", { status: 400 });
        }
        // Own controller so a closed browser tab / Stop button cancels the
        // upstream call quietly instead of surfacing an unhandled AbortError.
        const ctrl = new AbortController();
        const onAbort = () => ctrl.abort();
        request.signal.addEventListener("abort", onAbort);
        try {
          const upstream = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ctrl.signal,
            body: JSON.stringify({
              model: body.model,
              messages: body.messages.slice(-12),
              stream: true,
              options: { num_ctx: 4096 },
            }),
          });
          if (!upstream.ok || !upstream.body) {
            return new Response(`AI সার্ভার সাড়া দেয়নি (${upstream.status})`, { status: 502 });
          }
          const reader = upstream.body.getReader();
          const stream = new ReadableStream<Uint8Array>({
            async pull(c) {
              try {
                const { done, value } = await reader.read();
                if (done) { request.signal.removeEventListener("abort", onAbort); c.close(); }
                else c.enqueue(value);
              } catch {
                try { c.close(); } catch { /* already closed */ }
              }
            },
            cancel() { ctrl.abort(); reader.cancel().catch(() => {}); },
          });
          return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } });
        } catch {
          if (ctrl.signal.aborted) return new Response(null, { status: 499 });
          return new Response("AI সার্ভারের সাথে সংযোগ হয়নি", { status: 502 });
        }
      },
    },
  },
});

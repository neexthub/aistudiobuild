import { createFileRoute } from "@tanstack/react-router";
import { ALLOWED_MODELS, OLLAMA_URL } from "@/lib/ollama.server";
import { z } from 'zod';

const requestSchema = z.object({ model: z.string().refine(m => ALLOWED_MODELS.includes(m)), format: z.literal('json').optional(), messages: z.array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.string().max(24000) }).strict()).min(1).max(12) }).strict();

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = requestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return new Response("ভুল অনুরোধ", { status: 400 });
        }
        const body = parsed.data;
        // Own controller so a closed browser tab / Stop button cancels the
        // upstream call quietly instead of surfacing an unhandled AbortError.
        const ctrl = new AbortController();
        const onAbort = () => ctrl.abort();
        if (request.signal.aborted) ctrl.abort();
        request.signal.addEventListener("abort", onAbort, { once: true });
        try {
          const upstream = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ctrl.signal,
            body: JSON.stringify({
              model: body.model,
              format: body.format,
              messages: body.messages.slice(-12),
              stream: true,
              options: { num_ctx: 4096 },
            }),
          });
          if (!upstream.ok || !upstream.body) {
            request.signal.removeEventListener('abort', onAbort);
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
                request.signal.removeEventListener('abort', onAbort);
                ctrl.abort();
                try { c.close(); } catch { /* already closed */ }
              }
            },
            cancel() { request.signal.removeEventListener('abort', onAbort); ctrl.abort(); reader.cancel().catch(() => {}); },
          });
          return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } });
        } catch {
          request.signal.removeEventListener('abort', onAbort);
          if (ctrl.signal.aborted) return new Response(null, { status: 499 });
          return new Response("AI সার্ভারের সাথে সংযোগ হয়নি", { status: 502 });
        }
      },
    },
  },
});

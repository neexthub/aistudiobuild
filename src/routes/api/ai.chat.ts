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
        try {
          const upstream = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: request.signal,
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
          return new Response(upstream.body, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } });
        } catch {
          return new Response("AI সার্ভারের সাথে সংযোগ হয়নি", { status: 502 });
        }
      },
    },
  },
});

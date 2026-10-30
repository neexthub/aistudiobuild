import { createFileRoute } from "@tanstack/react-router";
import { OLLAMA_URL } from "@/lib/ollama.server";

export const Route = createFileRoute("/api/ai/status")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(7000) });
          const j = (await r.json()) as { models?: { name: string }[] };
          return Response.json({ ok: r.ok, models: (j.models ?? []).map((m) => m.name) });
        } catch {
          return Response.json({ ok: false, models: [] });
        }
      },
    },
  },
});

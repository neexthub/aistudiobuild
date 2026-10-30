import { createFileRoute } from "@tanstack/react-router";
import { candidates } from '@/lib/ai-router.server';

export const Route = createFileRoute("/api/ai/status")({
  server: {
    handlers: {
      GET: async () => {
        const list = await candidates('fast');
        return Response.json({ ok: list.length > 0, models: list.map(c => c.label) });
      },
    },
  },
});

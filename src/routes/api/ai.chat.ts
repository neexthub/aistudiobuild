import { createFileRoute } from "@tanstack/react-router";
import { z } from 'zod';
import { openStream, sseToNdjson } from '@/lib/ai-router.server';

const part = z.union([z.object({ type: z.literal('text'), text: z.string().max(60000) }).strict(), z.object({ type: z.literal('image_url'), image_url: z.object({ url: z.string().url().max(4000) }).strict() }).strict()]);
const requestSchema = z.object({ role: z.enum(['planner', 'coder', 'quality', 'fast']), format: z.literal('json').optional(), attempt: z.number().int().min(0).max(10).optional(), messages: z.array(z.object({ role: z.enum(['system', 'user', 'assistant']), content: z.union([z.string().max(60000), z.array(part).max(8)]) }).strict()).min(1).max(20) }).strict();

export const Route = createFileRoute("/api/ai/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = requestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("ভুল অনুরোধ", { status: 400 });
        const ctrl = new AbortController();
        request.signal.addEventListener("abort", () => ctrl.abort(), { once: true });
        try {
          const { body, label } = await openStream(parsed.data.role, parsed.data.messages, parsed.data.format === 'json', ctrl.signal, parsed.data.attempt ?? 0);
          return new Response(sseToNdjson(body, label), { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } });
        } catch (e) {
          if (ctrl.signal.aborted) return new Response(null, { status: 499 });
          return new Response(e instanceof Error ? e.message : 'AI সংযোগ ব্যর্থ', { status: 502 });
        }
      },
    },
  },
});

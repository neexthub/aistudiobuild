import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

const genSchema = z.object({ prompt: z.string().trim().min(2).max(2000) }).strict();
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export const Route = createFileRoute('/api/ai/media')({
  server: {
    handlers: {
      // multipart upload (field "file") → stores image and returns its link;
      // JSON {prompt} → generates an image with AI and returns its link.
      POST: async ({ request }) => {
        const { generateImage, storeMedia } = await import('@/lib/media.server');
        try {
          if ((request.headers.get('content-type') ?? '').includes('multipart/form-data')) {
            const form = await request.formData();
            const file = form.get('file');
            if (!(file instanceof File) || !ALLOWED.includes(file.type) || file.size > 8_000_000) return Response.json({ error: 'শুধু ৮MB পর্যন্ত PNG/JPG/WEBP/GIF ছবি দেওয়া যাবে।' }, { status: 400 });
            const url = await storeMedia(new Uint8Array(await file.arrayBuffer()), file.type, file.type.split('/')[1] ?? 'png');
            return Response.json({ url });
          }
          const parsed = genSchema.safeParse(await request.json().catch(() => null));
          if (!parsed.success) return Response.json({ error: 'ছবির বর্ণনা লিখুন।' }, { status: 400 });
          return Response.json({ url: await generateImage(parsed.data.prompt, request.signal) });
        } catch (e) {
          const status = (e as { status?: number }).status ?? 502;
          return Response.json({ error: (e as Error).message }, { status: status >= 400 && status < 600 ? status : 502 });
        }
      },
    },
  },
});

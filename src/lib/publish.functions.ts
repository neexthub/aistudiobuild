import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const publishApp = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ slug: z.string().regex(/^[a-z0-9-]{1,60}$/), name: z.string().min(1).max(120), html: z.string().min(1).max(2_000_000), ownerKey: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: existing } = await supabaseAdmin.from('published_apps').select('owner_key').eq('slug', data.slug).maybeSingle();
    if (existing && existing.owner_key !== data.ownerKey) return { ok: false as const, conflict: true };
    const { error } = await supabaseAdmin.from('published_apps').upsert({ slug: data.slug, name: data.name, html: data.html, owner_key: data.ownerKey, updated_at: new Date().toISOString() });
    if (error) throw new Error('প্রকাশ ব্যর্থ হয়েছে');
    return { ok: true as const, conflict: false };
  });

export const getPublishedApp = createServerFn({ method: 'GET' })
  .inputValidator((d: unknown) => z.object({ slug: z.string().max(80) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: row } = await supabaseAdmin.from('published_apps').select('name, html').eq('slug', data.slug).maybeSingle();
    return row ?? null;
  });

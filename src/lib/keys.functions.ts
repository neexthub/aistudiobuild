import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { PROVIDERS } from './providers';

// Shared key pool (no accounts by design). Keys are write-only: the full key
// is never returned to any browser, only a masked tail.
export const listKeys = createServerFn({ method: 'GET' }).handler(async () => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('ai_keys').select('id, provider, api_key, label, cooldown_until, fail_count, use_count').order('created_at');
  if (error) return { keys: [], error: 'কী তালিকা পড়া যায়নি' };
  return { keys: (data ?? []).map(k => ({ id: k.id, provider: k.provider, label: k.label, masked: '••••' + k.api_key.slice(-4), cooling: !!k.cooldown_until && new Date(k.cooldown_until).getTime() > Date.now(), fails: k.fail_count, uses: k.use_count })), error: null };
});

export const addKey = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ provider: z.string().refine(p => PROVIDERS.some(x => x.id === p)), apiKey: z.string().trim().min(8).max(400), label: z.string().max(60).default('') }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { error } = await supabaseAdmin.from('ai_keys').insert({ provider: data.provider, api_key: data.apiKey, label: data.label });
    if (error) throw new Error('কী সংরক্ষণ হয়নি');
    return { ok: true };
  });

export const deleteKey = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await supabaseAdmin.from('ai_keys').delete().eq('id', data.id);
    return { ok: true };
  });

export const resetKey = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    await supabaseAdmin.from('ai_keys').update({ cooldown_until: null, fail_count: 0 }).eq('id', data.id);
    return { ok: true };
  });

import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { PROVIDERS } from './providers';

// Shared key pool (no accounts by design). Keys are write-only: the full key
// is never returned to any browser, only a masked tail.
export const listKeys = createServerFn({ method: 'GET' }).handler(async () => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('ai_keys').select('id, provider, label, cooldown_until, fail_count, use_count, last_status, last_error, last_used_at, last_checked_at, last_model, rate_limit, rate_remaining, rate_reset, token_remaining').order('created_at');
  if (error) return { keys: [], error: 'কী তালিকা পড়া যায়নি' };
  return { keys: (data ?? []).map(k => ({ id: k.id, provider: k.provider, label: k.label, masked: '••••••••', cooling: !!k.cooldown_until && new Date(k.cooldown_until).getTime() > Date.now(), cooldownUntil: k.cooldown_until, fails: k.fail_count, uses: k.use_count, status: k.last_status, error: k.last_error, usedAt: k.last_used_at, checkedAt: k.last_checked_at, model: k.last_model, limit: k.rate_limit, remaining: k.rate_remaining, reset: k.rate_reset, tokens: k.token_remaining })), error: null };
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

/** Live check: sends a 1-token request with each key (or one key) and records status + rate-limit headers. */
export const checkKeys = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { mark } = await import('./ai-router.server');
    let q = supabaseAdmin.from('ai_keys').select('id, provider, api_key');
    if (data.id) q = q.eq('id', data.id);
    const { data: rows } = await q;
    await Promise.all((rows ?? []).map(async k => {
      const p = PROVIDERS.find(x => x.id === k.provider); if (!p) return;
      try {
        const r = await fetch(`${p.baseUrl}/chat/completions`, { method: 'POST', signal: AbortSignal.timeout(25000), headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k.api_key}` }, body: JSON.stringify({ model: p.models.fast, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 }) });
        const t = r.ok ? '' : await r.text().catch(() => '');
        await mark(k.id, r.ok, r.status, r.headers, r.ok ? undefined : `${r.status} ${t.replace(/\s+/g, ' ').slice(0, 200)}`, p.models.fast);
      } catch { await mark(k.id, false, 0, undefined, 'সংযোগ ব্যর্থ / সময় শেষ', p.models.fast); }
      await supabaseAdmin.from('ai_keys').update({ last_checked_at: new Date().toISOString() }).eq('id', k.id);
    }));
    return { ok: true };
  });

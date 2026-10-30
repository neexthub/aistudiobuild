// Server-only multi-provider router: rotates keys from the shared pool, cools
// down keys that hit quota/errors, falls back across providers and finally to
// the built-in Lovable AI gateway.
import { PROVIDERS, type AgentRole } from './providers';

type Msg = { role: string; content: string };
type Candidate = { label: string; url: string; key: string; model: string; keyId?: string };
const BUILTIN_MODELS: Record<AgentRole, string> = { planner: 'google/gemini-3.8-flash', coder: 'google/gemini-3.8-flash', quality: 'google/gemini-3.8-flash', fast: 'google/gemini-3.1-flash-lite' };

async function admin() { return (await import('@/integrations/supabase/client.server')).supabaseAdmin; }

export async function candidates(role: AgentRole): Promise<Candidate[]> {
  const out: Candidate[] = [];
  try {
    const db = await admin();
    const { data } = await db.from('ai_keys').select('id, provider, api_key, cooldown_until, use_count').order('use_count', { ascending: true });
    const now = Date.now();
    for (const k of data ?? []) {
      if (k.cooldown_until && new Date(k.cooldown_until).getTime() > now) continue;
      const p = PROVIDERS.find(x => x.id === k.provider); if (!p) continue;
      out.push({ label: `${p.name} · ${p.models[role]}`, url: `${p.baseUrl}/chat/completions`, key: k.api_key, model: p.models[role], keyId: k.id });
    }
  } catch (e) { console.error('key pool read failed', e); }
  const lk = process.env['LOVABLE_API_KEY'];
  if (lk) out.push({ label: `Lovable AI · ${BUILTIN_MODELS[role]}`, url: 'https://ai.gateway.lovable.dev/v1/chat/completions', key: lk, model: BUILTIN_MODELS[role] });
  return out;
}

async function mark(keyId: string | undefined, ok: boolean, status = 0) {
  if (!keyId) return;
  try {
    const db = await admin();
    const { data } = await db.from('ai_keys').select('use_count, fail_count').eq('id', keyId).single();
    if (!data) return;
    if (ok) await db.from('ai_keys').update({ use_count: data.use_count + 1, fail_count: 0 }).eq('id', keyId);
    else {
      const secs = status === 401 || status === 403 ? 86400 : status === 429 ? 90 : 30;
      await db.from('ai_keys').update({ fail_count: data.fail_count + 1, cooldown_until: new Date(Date.now() + secs * 1000).toISOString() }).eq('id', keyId);
    }
  } catch (e) { console.error('key mark failed', e); }
}

/** Opens a streaming completion on the first candidate that answers OK. */
export async function openStream(role: AgentRole, messages: Msg[], json: boolean, signal: AbortSignal): Promise<{ body: ReadableStream<Uint8Array>; label: string }> {
  const list = await candidates(role);
  if (!list.length) throw new Error('কোনো AI প্রোভাইডার পাওয়া যায়নি। সেটিংসে API key যোগ করুন।');
  const errors: string[] = [];
  const pool = list.filter(c => c.keyId).slice(0, 7);
  const tries = [...pool, ...list.filter(c => !c.keyId)];
  for (const c of tries) {
    try {
      const r = await fetch(c.url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.key}` }, body: JSON.stringify({ model: c.model, messages, stream: true, temperature: 0.3, ...(json ? { response_format: { type: 'json_object' } } : {}) }) });
      if (r.ok && r.body) { void mark(c.keyId, true); return { body: r.body, label: c.label }; }
      errors.push(`${c.label}: ${r.status}`); void mark(c.keyId, false, r.status);
      await r.body?.cancel().catch(() => {});
    } catch (e) {
      if (signal.aborted) throw e;
      errors.push(`${c.label}: সংযোগ ব্যর্থ`); void mark(c.keyId, false);
    }
  }
  console.error('all providers failed', errors);
  throw new Error('সব প্রোভাইডার ব্যস্ত বা কোটা শেষ: ' + errors.join(', '));
}

/** Converts OpenAI SSE into NDJSON lines {message:{content}} for the browser. */
export function sseToNdjson(body: ReadableStream<Uint8Array>, label: string): ReadableStream<Uint8Array> {
  const reader = body.getReader(), dec = new TextDecoder(), enc = new TextEncoder();
  let buf = '', sent = false;
  return new ReadableStream({
    async pull(c) {
      if (!sent) { sent = true; c.enqueue(enc.encode(JSON.stringify({ provider: label }) + '\n')); return; }
      try {
        const { done, value } = await reader.read();
        if (done) { c.close(); return; }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() ?? '';
        let out = '';
        for (const line of lines) {
          const t = line.trim(); if (!t.startsWith('data:')) continue;
          const d = t.slice(5).trim(); if (d === '[DONE]') continue;
          try { const j = JSON.parse(d); const tok = j.choices?.[0]?.delta?.content; if (tok) out += JSON.stringify({ message: { content: tok } }) + '\n'; } catch { /* partial */ }
        }
        if (out) c.enqueue(enc.encode(out));
      } catch { try { c.close(); } catch { /* closed */ } }
    },
    cancel() { reader.cancel().catch(() => {}); },
  });
}

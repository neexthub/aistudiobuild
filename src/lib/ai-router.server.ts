// Server-only multi-provider router. Lovable AI is tried first (fast + high
// quality); if it is busy or out of credit, keys from the shared free pool are
// rotated with cooldowns, falling back across providers.
import { PROVIDERS, type AgentRole } from './providers';

export type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
type Msg = { role: string; content: string | Part[] };
type Candidate = { label: string; url: string; key: string; model: string; keyId?: string; vision: boolean; builtin?: boolean };
export const BUILTIN_MODELS: Record<AgentRole, string> = { planner: 'google/gemini-3.8-flash', coder: 'google/gemini-3.8-flash', quality: 'google/gemini-3.8-flash', fast: 'google/gemini-3.1-flash-lite' };

async function admin() { return (await import('@/integrations/supabase/client.server')).supabaseAdmin; }

export async function candidates(role: AgentRole): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const lk = process.env['LOVABLE_API_KEY'];
  try {
    const db = await admin();
    const { data } = await db.from('ai_keys').select('id, provider, api_key, cooldown_until, use_count').order('use_count', { ascending: true });
    const now = Date.now();
    if (lk) {
      // Lovable AI status lives in a marker row (provider 'lovable', no real key stored) so settings can show it.
      let row = (data ?? []).find(k => k.provider === 'lovable');
      if (!row) { const ins = await db.from('ai_keys').insert({ provider: 'lovable', api_key: 'builtin', label: 'Lovable AI (ডিফল্ট)' }).select('id, provider, api_key, cooldown_until, use_count').single(); row = ins.data ?? undefined; }
      if (!row?.cooldown_until || new Date(row.cooldown_until).getTime() <= now) out.push({ label: `Lovable AI · ${BUILTIN_MODELS[role]}`, url: 'https://ai.gateway.lovable.dev/v1/chat/completions', key: lk, model: BUILTIN_MODELS[role], vision: true, keyId: row?.id, builtin: true });
    }
    for (const k of data ?? []) {
      if (k.cooldown_until && new Date(k.cooldown_until).getTime() > now) continue;
      const p = PROVIDERS.find(x => x.id === k.provider); if (!p) continue;
      out.push({ label: `${p.name} · ${p.models[role]}`, url: `${p.baseUrl}/chat/completions`, key: k.api_key, model: p.models[role], keyId: k.id, vision: p.id === 'gemini' });
    }
  } catch (e) { console.error('key pool read failed', e); }
  return out;
}

/** Lovable AI first; then pool keys grouped by provider, so a failing key falls to the same provider's other key before the next provider. */
export function orderCandidates<T extends { keyId?: string; label: string; builtin?: boolean }>(list: T[]): T[] {
  const builtin = list.filter(c => c.builtin || !c.keyId), pool = list.filter(c => !c.builtin && c.keyId);
  const groups = new Map<string, T[]>();
  for (const c of pool) { const p = c.label.split(' · ')[0]!; groups.set(p, [...(groups.get(p) ?? []), c]); }
  return [...builtin, ...[...groups.values()].flat()].slice(0, 24);
}

/** User-facing message once every model failed twice. */
export function noBalanceMessage(codes: number[], errors: string[]) {
  if (!errors.length) return 'কোনো AI মডেল এখন ব্যবহারযোগ্য নেই — সব API key-এর ব্যালেন্স বা লিমিট শেষ। সেটিংসে নতুন key যোগ করুন বা কিছুক্ষণ পরে চেষ্টা করুন।';
  if (codes.length && codes.every(c => [401, 402, 403, 429].includes(c))) return 'কোনো API-তে ব্যালেন্স বা লিমিট বাকি নেই (402/429)। সেটিংসে নতুন key যোগ করুন বা লিমিট রিসেট হওয়া পর্যন্ত অপেক্ষা করুন।';
  return 'সব মডেলে দুইবার চেষ্টা করেও উত্তর আসেনি: ' + errors.slice(0, 8).join(', ');
}

/** Reads provider rate-limit headers (OpenAI-style, Groq, OpenRouter, GitHub). */
export function rateInfo(h: Headers) {
  const num = (...n: string[]) => { for (const k of n) { const v = h.get(k); if (v != null && v !== '' && !isNaN(Number(v))) return Math.round(Number(v)); } return null; };
  return {
    rate_limit: num('x-ratelimit-limit-requests', 'x-ratelimit-limit', 'x-ratelimit-limit-requests-day'),
    rate_remaining: num('x-ratelimit-remaining-requests', 'x-ratelimit-remaining', 'x-ratelimit-remaining-requests-day'),
    token_remaining: num('x-ratelimit-remaining-tokens'),
    rate_reset: h.get('x-ratelimit-reset-requests') ?? h.get('x-ratelimit-reset') ?? h.get('retry-after'),
  };
}

/** Cooldown per status: auth/credit problems long, rate limits short (honours Retry-After). */
export function cooldownSecs(status: number, retryAfter?: string | null) {
  if (status === 401 || status === 403) return 86400;
  if (status === 402) return 6 * 3600;
  if (status === 404 || status === 410) return 3600;
  if (status === 429) { const r = Number(retryAfter); return r > 0 && r < 3600 ? Math.ceil(r) : 90; }
  return 30;
}

export async function mark(keyId: string | undefined, ok: boolean, status = 0, headers?: Headers, error?: string, model?: string) {
  if (!keyId) return;
  try {
    const db = await admin();
    const { data } = await db.from('ai_keys').select('use_count, fail_count').eq('id', keyId).single();
    if (!data) return;
    const info = headers ? rateInfo(headers) : {};
    const common = { ...info, last_status: status || null, last_used_at: new Date().toISOString(), ...(model ? { last_model: model } : {}) };
    if (ok) await db.from('ai_keys').update({ ...common, use_count: data.use_count + 1, fail_count: 0, last_error: null, cooldown_until: null }).eq('id', keyId);
    else await db.from('ai_keys').update({ ...common, last_error: (error ?? 'সংযোগ ব্যর্থ').slice(0, 300), fail_count: data.fail_count + 1, cooldown_until: new Date(Date.now() + cooldownSecs(status, headers?.get('retry-after')) * 1000).toISOString() }).eq('id', keyId);
  } catch (e) { console.error('key mark failed', e); }
}

/** Opens a streaming completion on the first candidate that answers OK. */
export async function openStream(role: AgentRole, messages: Msg[], json: boolean, signal: AbortSignal, attempt = 0): Promise<{ body: ReadableStream<Uint8Array>; label: string }> {
  const hasImages = messages.some(m => Array.isArray(m.content) && m.content.some(p => p.type === 'image_url'));
  const textOnly = messages.map(m => Array.isArray(m.content) ? { ...m, content: m.content.map(p => p.type === 'text' ? p.text : '[ছবি সংযুক্ত]').join('\n') } : m);
  const errors: string[] = [], codes: number[] = [];
  for (let round = 0; round < 2; round++) {
  if (round) await new Promise(r => setTimeout(r, 2500));
  const list = await candidates(role);
  if (!list.length) continue;
  const ordered = orderCandidates(list);
  // A retry (attempt > 0) starts on a different model so a bad answer is not repeated.
  const k = attempt % Math.max(1, ordered.length);
  const tries = [...ordered.slice(k), ...ordered.slice(0, k)];
  for (const c of tries) {
    try {
      const body = { model: c.model, messages: hasImages && !c.vision ? textOnly : messages, stream: true, ...(!c.builtin ? { temperature: 0.3 } : {}), ...(json ? { response_format: { type: 'json_object' } } : {}) };
      const r = await fetch(c.url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${c.key}` }, body: JSON.stringify(body) });
      if (r.ok && r.body) { void mark(c.keyId, true, r.status, r.headers, undefined, c.model); return { body: r.body, label: c.label }; }
      const errText = await r.text().catch(() => '');
      errors.push(`${c.label}: ${r.status}`); codes.push(r.status); void mark(c.keyId, false, r.status, r.headers, `${r.status} ${errText.replace(/\s+/g, ' ').slice(0, 200)}`, c.model);
    } catch (e) {
      if (signal.aborted) throw e;
      errors.push(`${c.label}: সংযোগ ব্যর্থ`); void mark(c.keyId, false);
    }
  }
  }
  console.error('all providers failed', errors);
  throw new Error(noBalanceMessage(codes, errors));
}

/** Converts OpenAI SSE into NDJSON lines {message:{content}} for the browser. */
export function sseToNdjson(body: ReadableStream<Uint8Array>, label: string): ReadableStream<Uint8Array> {
  const reader = body.getReader(), dec = new TextDecoder(), enc = new TextEncoder();
  let buf = '', sent = false, finished = false, cut = false;
  return new ReadableStream({
    async pull(c) {
      if (!sent) { sent = true; c.enqueue(enc.encode(JSON.stringify({ provider: label }) + '\n')); return; }
      try {
        for (;;) {
        const { done, value } = await reader.read();
        if (done) { if (!finished || cut) c.enqueue(enc.encode(JSON.stringify({ error: 'মডেলের উত্তর অসম্পূর্ণ অবস্থায় থেমে গেছে' }) + '\n')); c.close(); return; }
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop() ?? '';
        let out = '';
        for (const line of lines) {
          const t = line.trim(); if (!t.startsWith('data:')) continue;
          const d = t.slice(5).trim(); if (d === '[DONE]') { if (!cut) finished = true; continue; }
          try { const j = JSON.parse(d); { const fr = j.choices?.[0]?.finish_reason; if (fr === 'length') cut = true; else if (fr) finished = true; } const tok = j.choices?.[0]?.delta?.content; if (tok) out += JSON.stringify({ message: { content: tok } }) + '\n'; } catch { /* partial */ }
        }
        // Keep reading until there is something to send: a pull that enqueues nothing stalls the stream.
        if (out) { c.enqueue(enc.encode(out)); return; }
        }
      } catch { try { c.enqueue(enc.encode(JSON.stringify({ error: 'মডেলের সংযোগ মাঝপথে বিচ্ছিন্ন' }) + '\n')); c.close(); } catch { /* closed */ } }
    },
    cancel() { reader.cancel().catch(() => {}); },
  });
}

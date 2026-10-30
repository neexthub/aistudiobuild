// Browser-side AI fetch utilities. All calls go through our server proxy
// (/api/ai/*) which talks to the self-hosted Ollama VPS.
import type { ChatMsg } from "./store";

import type { AgentRole } from "./providers";
export const MODELS = { fast: "অটো মাল্টি-প্রোভাইডার", reason: "অটো মাল্টি-প্রোভাইডার" } as const;

export const SYSTEM_PROMPT = `তুমি NextBuild এর AI এজেন্ট। সবসময় বাংলায় কথা বলবে।
ব্যবহারকারী যে অ্যাপ চায়, তার জন্য একটি সম্পূর্ণ, কাজ করা, একক HTML ফাইল তৈরি করবে (CSS ও JavaScript একই ফাইলে, <style> ও <script> ট্যাগে)।
নিয়ম:
- প্রথমে বাংলায় ১-২ লাইনে বলো কী বানাচ্ছ।
- তারপর পুরো কোড একটি \`\`\`html কোড ব্লকে দাও। <!DOCTYPE html> থেকে </html> পর্যন্ত সম্পূর্ণ।
- আধুনিক, সুন্দর, মোবাইল-বান্ধব ডিজাইন। ডেটা রাখতে হলে localStorage ব্যবহার করো।
- আগের কোড থাকলে, পরিবর্তন করে পুরো নতুন ফাইল আবার দাও।`;

export const PLAN_PROMPT = `তুমি একজন সফটওয়্যার আর্কিটেক্ট। বাংলায় সংক্ষেপে (সর্বোচ্চ ৮ পয়েন্টে) অ্যাপটির পরিকল্পনা লেখো: পেজ/সেকশন, ফিচার, ডেটা, ডিজাইন। কোনো কোড লিখবে না।`;

export function extractHtml(text: string): string | null {
  const m = text.match(/```html\s*([\s\S]*?)(```|$)/i);
  const code = m?.[1]?.trim();
  if (code && /<(html|body|div|!doctype)/i.test(code)) return code;
  const raw = text.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
  return raw ? raw[0] : null;
}

export async function checkStatus(): Promise<{ ok: boolean; models: string[] }> {
  try {
    const r = await fetch("/api/ai/status", { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return { ok: false, models: [] };
    return await r.json();
  } catch {
    return { ok: false, models: [] };
  }
}

/** Uploads an image file; returns a link the agents can see and embed. */
export async function uploadImage(file: File): Promise<string> {
  const form = new FormData(); form.append('file', file);
  const r = await fetch('/api/ai/media', { method: 'POST', body: form });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(j.error ?? 'ছবি আপলোড ব্যর্থ');
  return j.url;
}

/** Generates an image with AI; returns a stored link. */
export async function generateImage(prompt: string, signal?: AbortSignal, kind: 'image' | 'icon' | 'audio' = 'image'): Promise<string> {
  const r = await fetch('/api/ai/media', { method: 'POST', signal: signal ?? null, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, kind }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.url) throw new Error(j.error ?? 'ছবি তৈরি ব্যর্থ');
  return j.url;
}

/** Streams a chat reply via the server router. Aborts if no token arrives for `idleMs`. */
export async function streamChat(opts: {
  role: AgentRole;
  onProvider?: (label: string) => void;
  system: string;
  messages: ChatMsg[];
  onToken: (t: string) => void;
  signal?: AbortSignal;
  idleMs?: number;
  format?: 'json';
  /** Image links attached to the last user message (vision). */
  images?: string[];
  /** Retry number; the server starts on a different model for each attempt. */
  attempt?: number;
}): Promise<string> {
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  if (opts.signal?.aborted) ctrl.abort();
  opts.signal?.addEventListener("abort", onAbort, { once: true });
  let idle: ReturnType<typeof setTimeout> | undefined;
  const bump = () => {
    clearTimeout(idle);
    idle = setTimeout(() => ctrl.abort(new Error("timeout")), opts.idleMs ?? 75_000);
  };
  bump();
  const msgs: { role: string; content: unknown }[] = opts.messages.map(({ role, content }) => ({ role, content }));
  const imgs = (opts.images ?? []).slice(0, 6);
  const last = msgs.at(-1);
  if (imgs.length && last) last.content = [{ type: 'text', text: last.content as string }, ...imgs.map(url => ({ type: 'image_url', image_url: { url } }))];
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        role: opts.role,
        format: opts.format,
        attempt: opts.attempt,
        messages: [{ role: "system", content: opts.system }, ...msgs],
      }),
    });
    if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || `সার্ভার ত্রুটি ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", full = "";
    const consume = (line: string) => {
      if (!line.trim()) return;
      const j = JSON.parse(line);
      if (j.error) throw new Error(j.error);
      if (j.provider) { opts.onProvider?.(j.provider); return; }
      const t = j.message?.content ?? '';
      if (t) { full += t; opts.onToken(t); }
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bump();
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        consume(line);
      }
    }
    buf += dec.decode();
    consume(buf);
    return full;
  } finally {
    clearTimeout(idle);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

/** Runs an AI step; if the answer is unusable or the model fails, retries on the next available model. */
export async function withFallback<T>(step: (attempt: number) => Promise<T>, signal?: AbortSignal, tries = 4, onRetry?: (attempt: number, error: unknown) => void): Promise<T> {
  let last: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try { return await step(attempt); }
    catch (e) { if (signal?.aborted) throw e; last = e; onRetry?.(attempt + 1, e); }
  }
  throw last;
}

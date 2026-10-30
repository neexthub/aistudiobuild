// Browser-side AI fetch utilities. All calls go through our server proxy
// (/api/ai/*) which talks to the self-hosted Ollama VPS.
import type { ChatMsg } from "./store";

export const MODELS = {
  fast: "qwen2.5-coder:7b",
  reason: "deepseek-coder-v2:latest",
} as const;

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

/** Streams an Ollama chat reply. Aborts if no token arrives for `idleMs`. */
export async function streamChat(opts: {
  model: string;
  system: string;
  messages: ChatMsg[];
  onToken: (t: string) => void;
  signal?: AbortSignal;
  idleMs?: number;
}): Promise<string> {
  const ctrl = new AbortController();
  opts.signal?.addEventListener("abort", () => ctrl.abort());
  let idle: ReturnType<typeof setTimeout> | undefined;
  const bump = () => {
    clearTimeout(idle);
    idle = setTimeout(() => ctrl.abort(new Error("timeout")), opts.idleMs ?? 120_000);
  };
  bump();
  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: opts.model,
        messages: [{ role: "system", content: opts.system }, ...opts.messages.map(({ role, content }) => ({ role, content }))],
      }),
    });
    if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || `সার্ভার ত্রুটি ${res.status}`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", full = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bump();
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line);
          if (j.error) throw new Error(j.error);
          const t = j.message?.content ?? "";
          if (t) { full += t; opts.onToken(t); }
        } catch (e) {
          if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
        }
      }
    }
    return full;
  } finally {
    clearTimeout(idle);
  }
}

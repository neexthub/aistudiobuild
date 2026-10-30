// Server-only media helpers: store bytes in the private studio-media bucket and
// return a long-lived signed link; generate images with Lovable AI.
const BUCKET = 'studio-media';
const IMAGE_MODEL = 'openai/gpt-image-2.5-sunburst';

export async function storeMedia(bytes: Uint8Array, type: string, ext: string): Promise<string> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const up = await supabaseAdmin.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false });
  if (up.error) throw new Error('ফাইল সংরক্ষণ ব্যর্থ: ' + up.error.message);
  const signed = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
  if (signed.error || !signed.data) throw new Error('লিংক তৈরি ব্যর্থ');
  return signed.data.signedUrl;
}

export async function generateImage(prompt: string, signal: AbortSignal): Promise<string> {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error('ছবি তৈরির AI সংযুক্ত নেই।');
  const r = await fetch('https://ai.gateway.lovable.dev/v1/images/generations', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: IMAGE_MODEL, prompt, quality: 'low', size: '1024x1024' }),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => '');
    throw Object.assign(new Error(r.status === 402 ? 'AI ক্রেডিট শেষ — ছবি তৈরি করা যায়নি।' : r.status === 429 ? 'অনেক অনুরোধ — একটু পরে চেষ্টা করুন।' : `ছবি তৈরি ব্যর্থ (${r.status}) ${msg.slice(0, 200)}`), { status: r.status });
  }
  const j = await r.json() as { data?: { b64_json?: string }[] };
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error('ছবি পাওয়া যায়নি।');
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return storeMedia(bytes, 'image/png', 'png');
}

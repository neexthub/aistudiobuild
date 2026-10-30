import { useEffect, useState } from 'react';
import { Activity, ExternalLink, Loader2, RotateCcw, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PROVIDERS, BUILTIN_NAME } from '@/lib/providers';
import { addKey, checkKeys, deleteKey, listKeys, resetKey } from '@/lib/keys.functions';

type Key = { id: string; provider: string; label: string; masked: string; cooling: boolean; cooldownUntil: string | null; fails: number; uses: number; status: number | null; error: string | null; usedAt: string | null; checkedAt: string | null; model: string | null; limit: number | null; remaining: number | null; reset: string | null; tokens: number | null };

const ago = (t: string | null) => { if (!t) return '—'; const s = Math.round((Date.now() - new Date(t).getTime()) / 1000); return s < 60 ? `${s} সেকেন্ড আগে` : s < 3600 ? `${Math.round(s / 60)} মিনিট আগে` : `${Math.round(s / 3600)} ঘণ্টা আগে`; };
const left = (t: string | null) => { if (!t) return ''; const s = Math.max(0, Math.round((new Date(t).getTime() - Date.now()) / 1000)); return s < 60 ? `${s} সে.` : s < 3600 ? `${Math.ceil(s / 60)} মি.` : `${Math.ceil(s / 3600)} ঘ.`; };
export function keyState(k: Pick<Key, 'cooling' | 'status'>): { label: string; tone: string } {
  if (k.cooling && (k.status === 401 || k.status === 403)) return { label: 'ব্লক — key ভুল/অনুমতি নেই', tone: 'text-destructive' };
  if (k.cooling && k.status === 402) return { label: 'ক্রেডিট শেষ', tone: 'text-destructive' };
  if (k.cooling && k.status === 429) return { label: 'লিমিট শেষ — বিরতি', tone: 'text-warning' };
  if (k.cooling) return { label: 'সাময়িক বিরতি', tone: 'text-warning' };
  if (k.status && k.status >= 200 && k.status < 300) return { label: 'চালু — ব্যবহারযোগ্য', tone: 'text-success' };
  return { label: 'এখনো যাচাই হয়নি', tone: 'text-muted-foreground' };
}

export function ProviderSettings({ onClose }: { onClose: () => void }) {
  const [keys, setKeys] = useState<Key[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [provider, setProvider] = useState(PROVIDERS[0]!.id), [apiKey, setApiKey] = useState(''), [label, setLabel] = useState(''), [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const load = async (quiet = false) => { if (!quiet) setLoading(true); const r = await listKeys(); setKeys(r.keys as Key[]); setError(r.error ?? ''); setLoading(false); };
  useEffect(() => { void load(); const t = setInterval(() => void load(true), 8000); return () => clearInterval(t); }, []);
  const check = async (id?: string) => { setChecking(id ?? 'all'); try { await checkKeys({ data: id ? { id } : {} }); await load(true); } catch { setError('লাইভ চেক ব্যর্থ'); } finally { setChecking(null); } };
  const usable = keys.filter(k => keyState(k).tone === 'text-success').length;
  const save = async () => {
    setSaving(true); setError('');
    try { await addKey({ data: { provider, apiKey, label } }); setApiKey(''); setLabel(''); await load(); }
    catch { setError('কী সংরক্ষণ হয়নি — key টি সঠিক কিনা দেখুন।'); }
    finally { setSaving(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-3">
    <section role="dialog" aria-modal="true" aria-label="AI প্রোভাইডার সেটিংস" className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-md border bg-card">
      <header className="flex items-center gap-2 border-b p-4"><h2 className="flex-1 text-lg font-semibold">AI প্রোভাইডার ও API Key</h2><Button variant="ghost" size="icon" aria-label="বন্ধ করুন" onClick={onClose}><X /></Button></header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <p className="text-xs text-muted-foreground">এখানে যোগ করা সব key সব ব্যবহারকারী শেয়ার করে। এজেন্টরা নিজে থেকে সেরা খালি মডেল বেছে নেয়; কোনো key-র কোটা শেষ হলে পরের key, তারপর অন্য প্রোভাইডার, শেষে {BUILTIN_NAME} ব্যবহার হয়। সংরক্ষিত key আর পুরোটা দেখা যায় না।</p>
        <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <select aria-label="প্রোভাইডার" value={provider} onChange={e => setProvider(e.target.value)} className="h-9 rounded-md border bg-background px-2 text-sm">{PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name} — {p.note}</option>)}</select>
          <input aria-label="API key" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API key পেস্ট করুন" className="h-9 rounded-md border bg-background px-2 text-sm" />
          <Button disabled={saving || apiKey.trim().length < 8} onClick={() => void save()}>{saving ? <Loader2 className="animate-spin" /> : null}যোগ করুন</Button>
          <input aria-label="নাম (ঐচ্ছিক)" value={label} onChange={e => setLabel(e.target.value)} placeholder="নাম (ঐচ্ছিক)" className="h-8 rounded-md border bg-background px-2 text-xs sm:col-span-2" />
          <a className="flex items-center gap-1 text-xs text-primary" href={PROVIDERS.find(p => p.id === provider)?.keyUrl} target="_blank" rel="noreferrer">ফ্রি key নিন <ExternalLink className="h-3 w-3" /></a>
        </div>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-xs"><Activity className="h-4 w-4 text-primary" /><span className="flex-1">মোট {keys.length}টি key · <span className="text-success">{usable}টি এখন ব্যবহারযোগ্য</span> · {keys.filter(k => k.cooling).length}টি বিরতিতে · প্রতি ৮ সেকেন্ডে লাইভ আপডেট</span><Button size="sm" variant="secondary" disabled={!!checking || !keys.length} onClick={() => void check()}>{checking === 'all' ? <Loader2 className="animate-spin" /> : <Activity />}সব key লাইভ চেক</Button></div>
        {loading ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />লোড হচ্ছে…</p> :
          <div className="space-y-3">{PROVIDERS.map(p => { const list = keys.filter(k => k.provider === p.id); return <div key={p.id} className="rounded-md border p-3">
            <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${list.some(k => !k.cooling) ? 'bg-success' : list.length ? 'bg-warning' : 'bg-muted-foreground/40'}`} /><h3 className="flex-1 text-sm font-semibold">{p.name}</h3><span className="text-[10px] text-muted-foreground">{list.length}টি key</span></div>
            <p className="mt-1 font-mono text-[10px] text-muted-foreground">plan: {p.models.planner} · code: {p.models.coder}</p>
            {list.map(k => { const st = keyState(k); return <div key={k.id} className="mt-2 rounded-md bg-background/50 p-2 text-xs"><div className="flex flex-wrap items-center gap-2"><span className="font-mono">{k.masked}</span><span className="text-muted-foreground">{k.label}</span><span className={`font-semibold ${st.tone}`}>● {st.label}</span>{k.cooling && <span className="text-warning">আবার চালু: {left(k.cooldownUntil)}</span>}<span className="ml-auto" /><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="এই key লাইভ চেক" title="লাইভ চেক" disabled={!!checking} onClick={() => void check(k.id)}>{checking === k.id ? <Loader2 className="animate-spin" /> : <Activity />}</Button><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="আবার চালু" title="আবার চালু" onClick={async () => { await resetKey({ data: { id: k.id } }); await load(); }}><RotateCcw /></Button><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="key মুছুন" onClick={async () => { if (!confirm('এই key মুছবেন?')) return; await deleteKey({ data: { id: k.id } }); await load(); }}><Trash2 /></Button></div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground sm:grid-cols-3"><span>বাকি অনুরোধ: <b className="text-foreground">{k.remaining ?? '—'}{k.limit != null ? ` / ${k.limit}` : ''}</b></span><span>বাকি টোকেন: <b className="text-foreground">{k.tokens ?? '—'}</b></span><span>লিমিট রিসেট: {k.reset ?? '—'}</span><span>মোট ব্যবহার: {k.uses} বার</span><span>ব্যর্থ পরপর: {k.fails}</span><span>শেষ কোড: {k.status ?? '—'}</span><span>শেষ ব্যবহার: {ago(k.usedAt)}</span><span>শেষ চেক: {ago(k.checkedAt)}</span><span className="truncate" title={k.model ?? ''}>মডেল: {k.model ?? '—'}</span></div>
              {k.error && <p className="mt-1 break-words text-[10px] text-destructive">{k.error}</p>}
              {k.remaining == null && k.status != null && <p className="mt-1 text-[10px] text-muted-foreground">এই প্রোভাইডার বাকি লিমিটের তথ্য পাঠায় না।</p>}</div>; })}
          </div>; })}
            <div className="rounded-md border border-primary/40 p-3 text-xs"><span className="font-semibold">{BUILTIN_NAME}</span> — সবসময় চালু, শেষ ভরসা।</div>
            <div className="rounded-md border p-3 text-xs"><span className="font-semibold">ছবি তৈরি (Pollinations)</span> — ফ্রি, key লাগে না; এজেন্টরা অ্যাপে স্বয়ংক্রিয়ভাবে ছবি বসায়।</div>
          </div>}
      </div>
    </section>
  </div>;
}

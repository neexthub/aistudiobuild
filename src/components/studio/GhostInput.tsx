import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { streamChat } from '@/lib/ai';

const SYSTEM = 'তুমি টাইপিং অটো-কমপ্লিট। ব্যবহারকারীর অসম্পূর্ণ লেখার ঠিক পরের ৩–৮টি শব্দ একই ভাষায় দাও, যাতে একটি অ্যাপ বানানোর অনুরোধ সম্পূর্ণ হয়। শুধু বাকি অংশটুকু লেখো — আগের লেখা আবার লিখবে না, উদ্ধৃতি বা ব্যাখ্যা নয়, এক লাইন।';

/** Chat input with inline ghost-text continuation: muted suggestion after the cursor; Tab, → or click accepts it. */
export function GhostInput({ value, onChange, onEnter, disabled }: { value: string; onChange: (v: string) => void; onEnter: () => void; disabled?: boolean }) {
  const [ghost, setGhost] = useState(''), area = useRef<HTMLTextAreaElement>(null), layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setGhost('');
    if (disabled || value.trim().length < 4 || value.length > 800) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const out = await streamChat({ role: 'fast', system: SYSTEM, messages: [{ role: 'user', content: value }], signal: ctrl.signal, onToken: () => {} });
        let s = out.split('\n')[0]!.replace(/^["'“”]+|["'“”]+$/g, '').trimEnd();
        if (s.startsWith(value.trim())) s = s.slice(value.trim().length);
        if (!s.trim() || ctrl.signal.aborted) return;
        setGhost((/\s$/.test(value) ? s.trimStart() : /^[\s,.!?।]/.test(s) ? s : ' ' + s).slice(0, 120));
      } catch { /* optional */ }
    }, 700);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value, disabled]);
  const accept = () => { if (!ghost) return; onChange(value + ghost); setGhost(''); area.current?.focus(); };
  const key = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (ghost && (e.key === 'Tab' || (e.key === 'ArrowRight' && e.currentTarget.selectionStart === value.length))) { e.preventDefault(); accept(); return; }
    if (e.key === 'Escape') setGhost('');
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnter(); }
  };
  const cls = 'min-h-[44px] w-full whitespace-pre-wrap break-words p-0 text-sm leading-6';
  return <div className="relative">
    <div ref={layer} aria-hidden="true" className={`${cls} pointer-events-none absolute inset-0 overflow-hidden text-transparent`}>{value}<span className="pointer-events-auto cursor-pointer rounded-sm bg-primary/10 text-primary/60" onMouseDown={e => { e.preventDefault(); accept(); }}>{ghost}</span></div>
    <textarea ref={area} aria-label="অ্যাপের অনুরোধ" rows={2} value={value} onChange={e => onChange(e.target.value)} onKeyDown={key} onScroll={e => { if (layer.current) layer.current.scrollTop = e.currentTarget.scrollTop; }} placeholder="আপনার অ্যাপের অনুরোধ লিখুন…" className={`${cls} relative resize-none bg-transparent outline-none`} />
    {ghost && <button type="button" onClick={accept} className="mt-1 text-[10px] text-muted-foreground hover:text-primary">Tab বা ক্লিক করে সাজেশন বসান</button>}
  </div>;
}

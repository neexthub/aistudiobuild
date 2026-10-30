import { useEffect, useRef, useState } from 'react';
import { Bot, Camera, Loader2, Monitor, Play, Smartphone, Square, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { bundleHtml, htmlPages } from '@/lib/project/bundle';
import type { FileMap } from '@/lib/project/files';

type Log = { id: string; kind: 'info' | 'act' | 'error' | 'shot' | 'ok'; text: string; shot?: string | undefined };

/** Agent-side script: reports errors, shows a fake cursor, performs clicks/typing and takes screenshots on request. */
const AGENT_SCRIPT = `<script data-nb-agent>(function(){function rep(m){try{parent.postMessage({nbT:'err',msg:String(m).slice(0,300)},'*')}catch(e){}}
window.addEventListener('error',function(e){rep(e.message+(e.lineno?' (লাইন '+e.lineno+')':''))});
window.addEventListener('unhandledrejection',function(e){rep('Promise: '+((e.reason&&e.reason.message)||e.reason))});
var ce=console.error;console.error=function(){rep([].slice.call(arguments).join(' '));ce.apply(console,arguments)};
var cur;function cursor(){if(!cur){cur=document.createElement('div');cur.style.cssText='position:fixed;z-index:2147483647;width:20px;height:20px;border-radius:50%;background:rgba(239,68,68,.85);box-shadow:0 0 0 6px rgba(239,68,68,.25);pointer-events:none;transition:left .45s ease,top .45s ease;left:8px;top:8px';document.documentElement.appendChild(cur)}return cur}
function targets(){return [].slice.call(document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[onclick],[role=button]')).filter(function(el){var r=el.getBoundingClientRect();return r.width>0&&r.height>0&&!el.disabled})}
function label(el){return el.tagName.toLowerCase()+': '+((el.innerText||el.value||el.placeholder||el.getAttribute('aria-label')||el.getAttribute('href')||'').trim().replace(/\\s+/g,' ').slice(0,40))}
window.addEventListener('message',function(e){var d=e.data||{};if(!d.nbT)return;
if(d.nbT==='scan'){var t=targets();parent.postMessage({nbT:'scan',items:t.slice(0,40).map(label),title:document.title,text:((document.body&&document.body.innerText)||'').trim().length},'*')}
if(d.nbT==='act'){var el=targets()[d.i];if(!el){parent.postMessage({nbT:'done',i:d.i,ok:false},'*');return}el.scrollIntoView({block:'center'});var r=el.getBoundingClientRect(),c=cursor();c.style.left=(r.left+r.width/2-10)+'px';c.style.top=(r.top+r.height/2-10)+'px';
setTimeout(function(){try{var tag=el.tagName;if(tag==='INPUT'||tag==='TEXTAREA'){el.focus();if(el.type==='checkbox'||el.type==='radio')el.click();else{el.value=el.type==='number'?'5':el.type==='email'?'test@example.com':el.type==='date'?'2026-01-01':'পরীক্ষা';el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}}else if(tag==='SELECT'){el.selectedIndex=Math.min(1,el.options.length-1);el.dispatchEvent(new Event('change',{bubbles:true}))}else{el.click()}}catch(err){rep(err.message)}
setTimeout(function(){parent.postMessage({nbT:'done',i:d.i,ok:true},'*')},500)},550)}
if(d.nbT==='shot'){var go=function(){window.html2canvas(document.body,{scale:.5,logging:false,useCORS:true}).then(function(c){parent.postMessage({nbT:'shot',url:c.toDataURL('image/jpeg',.6)},'*')}).catch(function(){parent.postMessage({nbT:'shot',url:''},'*')})};if(window.html2canvas)go();else{var s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';s.onload=go;s.onerror=function(){parent.postMessage({nbT:'shot',url:''},'*')};document.head.appendChild(s)}}
});})();</script>`;

const withAgent = (html: string) => /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + AGENT_SCRIPT) : AGENT_SCRIPT + html;

/** Separate "AI live browser": runs its own copy of the app, clicks through every page, screenshots, collects errors, and can hand them to the fix agent. */
export function AgentBrowser({ files, autoRun, busy, onFix, onManualFix, onReport }: { files: FileMap; autoRun: number; busy: boolean; onFix: (issues: string[]) => void; onManualFix: (issues: string[]) => void; onReport: (text: string) => void }) {
  const frame = useRef<HTMLIFrameElement>(null), loaded = useRef<(() => void) | null>(null), stop = useRef(false), errs = useRef<string[]>([]);
  const [page, setPage] = useState('index.html'), [key, setKey] = useState(0), [running, setRunning] = useState(false), [logs, setLogs] = useState<Log[]>([]), [mobile, setMobile] = useState(false), [issues, setIssues] = useState<string[]>([]);
  const filesRef = useRef(files); filesRef.current = files;
  const html = bundleHtml(files, page);
  const add = (kind: Log['kind'], text: string, shot?: string) => setLogs(l => [...l.slice(-80), { id: crypto.randomUUID(), kind, text, shot }]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const d = e.data as { nbT?: string; msg?: string };
      if (d?.nbT === 'err' && d.msg) { errs.current.push(`${page}: ${d.msg}`); add('error', d.msg); }
    };
    window.addEventListener('message', on); return () => window.removeEventListener('message', on);
  }, [page]);

  const wait = <T,>(type: string, ms: number) => new Promise<T | null>(res => {
    const t = setTimeout(() => { off(); res(null); }, ms);
    const on = (e: MessageEvent) => { if (e.source !== frame.current?.contentWindow) return; const d = e.data as { nbT?: string; nbNav?: string }; if (d?.nbT === type || (type === 'done' && d?.nbNav)) { off(); res(d as T); } };
    const off = () => { clearTimeout(t); window.removeEventListener('message', on); };
    window.addEventListener('message', on);
  });
  const post = (msg: unknown) => frame.current?.contentWindow?.postMessage(msg, '*');
  const load = (p: string) => new Promise<void>(res => { loaded.current = res; setPage(p); setKey(k => k + 1); setTimeout(res, 4000); });
  const shot = async (label: string) => { post({ nbT: 'shot' }); const s = await wait<{ url: string }>('shot', 8000); if (s?.url) add('shot', label, s.url); };

  const run = async () => {
    if (running) return;
    const pages = htmlPages(filesRef.current).slice(0, 6);
    if (!pages.length) { add('error', 'কোনো HTML পেজ নেই — আগে অ্যাপ তৈরি করুন।'); return; }
    stop.current = false; errs.current = []; setIssues([]); setLogs([]); setRunning(true);
    add('info', `AI ব্রাউজার চালু — ${pages.length}টি পেজ পরীক্ষা হবে`);
    let actions = 0;
    try {
      for (const p of pages) {
        if (stop.current) break;
        add('info', `খোলা হচ্ছে: ${p}`); await load(p); await new Promise(r => setTimeout(r, 600));
        post({ nbT: 'scan' }); const scan = await wait<{ items: string[]; title: string; text: number }>('scan', 3000);
        if (!scan) { errs.current.push(`${p}: পেজ সাড়া দিচ্ছে না`); add('error', 'পেজ সাড়া দিচ্ছে না'); continue; }
        if (scan.text < 20) { errs.current.push(`${p}: পেজ প্রায় ফাঁকা দেখাচ্ছে`); add('error', 'পেজ প্রায় ফাঁকা'); }
        add('ok', `"${scan.title || p}" — ${scan.items.length}টি বাটন/লিংক/ইনপুট`);
        await shot(`${p} — খোলার পর`);
        for (let i = 0; i < Math.min(scan.items.length, 8) && !stop.current; i++) {
          const item = scan.items[i]!; add('act', `ক্লিক/টাইপ → ${item}`);
          post({ nbT: 'act', i }); const r = await wait<{ nbNav?: string }>('done', 4000); actions++;
          if (r?.nbNav) { add('info', `লিংক কাজ করছে → ${r.nbNav}`); await load(p); await new Promise(res => setTimeout(res, 500)); }
          else if (!r) { errs.current.push(`${p}: "${item}" ক্লিকের পরে পেজ আটকে গেছে`); add('error', 'ক্লিকের পরে সাড়া নেই'); await load(p); }
        }
        await shot(`${p} — পরীক্ষার পর`);
      }
    } finally {
      const found = [...new Set(errs.current)].slice(0, 15); setIssues(found); setRunning(false);
      add(found.length ? 'error' : 'ok', found.length ? `${found.length}টি সমস্যা পাওয়া গেছে` : `সব ঠিক — ${actions}টি ক্লিক/টাইপ, কোনো ত্রুটি নেই ✓`);
      onReport(found.length ? `AI ব্রাউজার টেস্ট: ${pages.length}টি পেজ, ${actions}টি ক্লিক — ${found.length}টি সমস্যা:\n- ${found.join('\n- ')}` : `AI ব্রাউজার টেস্ট: ${pages.length}টি পেজ, ${actions}টি ক্লিক/টাইপ — কোনো ত্রুটি নেই ✓`);
      if (found.length && autoRun > 0) onFix(found);
    }
  };

  useEffect(() => { if (autoRun > 0) void run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [autoRun]);

  return <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b px-3 text-xs">
        <Bot className="h-4 w-4 text-primary" /><span className="font-semibold">AI লাইভ ব্রাউজার</span>
        <span className="ml-2 truncate rounded bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">nextbuild://{page}</span>
        {running && <span className="flex items-center gap-1 text-primary"><span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />লাইভ</span>}
        <div className="ml-auto flex items-center gap-1">
          <Button variant={mobile ? 'ghost' : 'secondary'} size="icon" aria-label="ডেস্কটপ" onClick={() => setMobile(false)}><Monitor /></Button>
          <Button variant={mobile ? 'secondary' : 'ghost'} size="icon" aria-label="মোবাইল" onClick={() => setMobile(true)}><Smartphone /></Button>
          {running ? <Button size="sm" variant="destructive" onClick={() => { stop.current = true; }}><Square />থামান</Button> : <Button size="sm" disabled={!html} onClick={() => void run()}><Play />টেস্ট চালান</Button>}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-muted/30 p-3">
        {html ? <iframe ref={frame} key={key} title="AI লাইভ ব্রাউজার" srcDoc={withAgent(html)} onLoad={() => loaded.current?.()} sandbox="allow-scripts allow-forms" className={`h-full w-full border bg-card ${mobile ? 'max-w-[390px]' : ''}`} /> : <p className="self-center text-sm text-muted-foreground">এখনো অ্যাপ তৈরি হয়নি।</p>}
      </div>
    </div>
    <aside className="flex max-h-[40%] min-h-0 flex-col border-t xl:max-h-none xl:w-80 xl:border-l xl:border-t-0">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3 text-xs font-semibold"><Camera className="h-4 w-4" />AI স্ট্রিম<span className="ml-auto font-normal text-muted-foreground">{logs.length}</span></div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3 font-mono text-[11px]">
        {!logs.length && <p className="text-muted-foreground">"টেস্ট চালান" চাপুন — AI নিজে প্রতিটা পেজ খুলে বাটন ক্লিক, ফর্মে লিখে, স্ক্রিনশট নিয়ে ত্রুটি খুঁজবে। বিল্ড শেষে এটা নিজে থেকেই চলে।</p>}
        {logs.map(l => <div key={l.id} className={l.kind === 'error' ? 'text-destructive' : l.kind === 'ok' ? 'text-success' : l.kind === 'act' ? 'text-primary' : 'text-muted-foreground'}>{l.kind === 'shot' ? <figure><figcaption>📸 {l.text}</figcaption><img src={l.shot} alt={l.text} className="mt-1 w-full rounded border" /></figure> : <p className="break-words">{l.kind === 'error' ? '✗ ' : l.kind === 'ok' ? '✓ ' : '› '}{l.text}</p>}</div>)}
        {running && <p className="flex items-center gap-1 text-primary"><Loader2 className="h-3 w-3 animate-spin" />চলছে…</p>}
      </div>
      {!running && issues.length > 0 && <div className="shrink-0 border-t p-2"><Button size="sm" className="w-full" disabled={busy} onClick={() => onManualFix(issues)}><Wrench />AI দিয়ে {issues.length}টি সমস্যা ঠিক করুন</Button></div>}
    </aside>
  </div>;
}

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bot, Code2, Eye, Globe, Loader2, RefreshCw, Send, Square, Files, Plus, Pencil, Trash2, Download, Monitor, Tablet, Smartphone, Terminal, Wrench, History, FileCode2, Search, X, Sparkles, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo, StatusDot } from '@/components/StatusDot';
import { RichText } from '@/components/CodeBlock';
import { SourceEditor } from '@/components/studio/SourceEditor';
import { PromptSuggestions } from '@/components/studio/PromptSuggestions';
import { getProject, updateProject, saveProjectFiles, editProjectFiles, restoreRevision, type Project, type ChatMsg } from '@/lib/store';
import { checkStatus, extractHtml, MODELS, streamChat, SYSTEM_PROMPT } from '@/lib/ai';
import { buildWithAgents } from '@/lib/agents/run';
import type { RunRecord } from '@/lib/agents/contracts';
import { nextTemplate } from '@/lib/project/template';
import { contentHash, fileChanges } from '@/lib/project/files';
import { downloadSource } from '@/lib/project/export';
import { TOOL_SERVICES } from '@/lib/services';

export const Route = createFileRoute('/project/$id')({
  head: () => ({ meta: [{ title: 'NextBuild Studio — বাংলা মাল্টি-ফাইল অ্যাপ বিল্ডার' }, { name: 'description', content: 'ফাইল সম্পাদনা, পরিকল্পনাভিত্তিক এজেন্ট, বাংলা চ্যাট এবং অ্যাপ প্রিভিউ।' }, { property: 'og:title', content: 'NextBuild Studio — অ্যাপ বিল্ডার' }, { property: 'og:description', content: 'বাংলা চ্যাট ও মাল্টি-ফাইল অ্যাপ স্টুডিও।' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Builder,
});
type View = 'preview' | 'files' | 'logs' | 'tools' | 'history';
const taskNames = { queued: 'অপেক্ষায়', running: 'কাজ চলছে', completed: 'শেষ', failed: 'ব্যর্থ', cancelled: 'বন্ধ' };
function Builder() {
  const { id } = Route.useParams(), nav = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [input, setInput] = useState(''), [mode, setMode] = useState<'agents' | 'html'>('agents');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [streaming, setStreaming] = useState('');
  const [view, setView] = useState<View>('preview'), [panel, setPanel] = useState<'chat' | 'workspace'>('chat');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop'), [frameKey, setFrameKey] = useState(0);
  const [selected, setSelected] = useState(''), [tabs, setTabs] = useState<string[]>([]), [draft, setDraft] = useState('');
  const [filter, setFilter] = useState(''), [suggestions, setSuggestions] = useState(false), [liveRun, setLiveRun] = useState<RunRecord | null>(null);
  const [publishOpen, setPublishOpen] = useState(false), [copied, setCopied] = useState(false);
  const ctrl = useRef<AbortController | null>(null), latest = useRef<Project | null>(null), bottom = useRef<HTMLDivElement>(null);
  const assign = (p: Project) => { latest.current = p; setProject(p); };
  useEffect(() => {
    const p = getProject(id); if (!p) { nav({ to: '/dashboard' }); return; }
    latest.current = p; setProject(p);
    const first = Object.keys(p.files ?? {})[0] ?? ''; setSelected(first); setDraft(p.files?.[first] ?? ''); setTabs(first ? [first] : []);
    const last = p.runs?.at(-1); if (last) setLiveRun(last);
    return () => ctrl.current?.abort();
  }, [id, nav]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [project?.messages.length, busy]);
  if (!project) return null;
  const files = project.files ?? {}, dirty = !!selected && draft !== files[selected];
  const protectDraft = () => !dirty || confirm('অসংরক্ষিত পরিবর্তন বাদ দেবেন?');
  const openFile = (path: string) => { if (!protectDraft()) return; setSelected(path); setDraft(files[path] ?? ''); setTabs(old => old.includes(path) ? old : [...old, path]); setView('files'); setPanel('workspace'); };
  const saveDraft = () => {
    if (!selected) return;
    try { assign(editProjectFiles(id, [{ op: 'update', path: selected, expectedHash: contentHash(files[selected] ?? ''), content: draft }])); setError(''); }
    catch (e) { setError((e as Error).message); }
  };
  const fileAction = (kind: 'create' | 'rename' | 'delete') => {
    if (!protectDraft()) return;
    try {
      if (kind === 'create') { const path = prompt('ফাইলের পথ', 'components/NewFeature.tsx'); if (!path) return; const p = editProjectFiles(id, [{ op: 'create', path, content: '' }]); assign(p); setSelected(path); setDraft(''); setTabs(old => [...old, path]); }
      else if (selected && kind === 'rename') { const path = prompt('নতুন ফাইলের পথ', selected); if (!path || path === selected) return; const p = editProjectFiles(id, [{ op: 'create', path, content: files[selected] ?? '' }, { op: 'delete', path: selected, expectedHash: contentHash(files[selected] ?? '') }]); assign(p); setTabs(old => old.map(t => t === selected ? path : t)); setSelected(path); }
      else if (selected && confirm(`${selected} মুছে ফেলবেন?`)) { const p = editProjectFiles(id, [{ op: 'delete', path: selected, expectedHash: contentHash(files[selected] ?? '') }]); assign(p); setTabs(old => old.filter(t => t !== selected)); setSelected(''); setDraft(''); }
      setError('');
    } catch (e) { setError((e as Error).message); }
  };
  const template = () => {
    if (!protectDraft() || (Object.keys(files).length > 0 && !confirm('বর্তমান source বদলে Next.js starter বসাবেন? পুরোনো source ইতিহাসে রাখা হবে।'))) return;
    try {
      let p = getProject(id); if (p && Object.keys(p.files ?? {}).length && !p.revisions?.length) p = saveProjectFiles(id, p.files ?? {}, 'পুরোনো source');
      const updated = saveProjectFiles(id, nextTemplate(), 'Next.js starter', 'next'); assign(updated); setSelected('app/page.tsx'); setDraft(updated.files?.['app/page.tsx'] ?? ''); setTabs(['app/page.tsx']); setView('files'); setPanel('workspace'); setError('');
    } catch (e) { setError((e as Error).message); }
  };
  const persistRun = (run: RunRecord) => {
    setLiveRun(run);
    const p = getProject(id); if (!p) return;
    const runs = [...(p.runs ?? []).filter(r => r.id !== run.id), run].slice(-10);
    const updated = updateProject(id, { runs }); if (updated) assign(updated);
  };
  const send = async () => {
    const goal = input.trim(); if (!goal || busy || !protectDraft()) return;
    setBusy(true); setError(''); setStreaming('');
    const abort = new AbortController(); ctrl.current = abort;
    try {
      const userMsg: ChatMsg = { role: 'user', content: goal };
      const p = updateProject(id, { messages: [...(latest.current?.messages ?? []), userMsg] }); if (p) assign(p);
      setInput('');
      if (mode === 'agents') {
        const base = Object.keys(files).length && project.kind === 'next' ? files : nextTemplate();
        const generated = await buildWithAgents(goal, base, abort.signal, persistRun, value => setStreaming(value));
        const result = saveProjectFiles(id, generated, 'এজেন্ট source update', 'next');
        const updated = updateProject(id, { messages: [...result.messages, { role: 'assistant', content: 'পরিকল্পনা অনুযায়ী source ফাইলগুলো তৈরি হয়েছে। প্রকৃত build ও public প্রকাশের জন্য VPS runner সংযোগ প্রয়োজন।', model: MODELS.fast }] }); if (updated) assign(updated);
        const first = Object.keys(generated).find(path => path === 'app/page.tsx') ?? Object.keys(generated)[0] ?? ''; setSelected(first); setDraft(generated[first] ?? ''); setTabs(first ? [first] : []); setView('files');
      } else {
        const status = await checkStatus(); if (!status.models.includes(MODELS.fast)) throw new Error(`VPS-এ ${MODELS.fast} নেই। নতুন মডেল ইনস্টল করুন।`);
        let full = '';
        const reply = await streamChat({ model: MODELS.fast, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: goal + (files['index.html'] ? '\nCurrent HTML:\n' + files['index.html'].slice(0, 6500) : '') }], signal: abort.signal, onToken: token => { full += token; setStreaming(full); } });
        const html = extractHtml(reply); if (!html) throw new Error('সম্পূর্ণ HTML পাওয়া যায়নি; source অপরিবর্তিত আছে।');
        const result = saveProjectFiles(id, { 'index.html': html }, 'HTML agent update', 'html');
        const updated = updateProject(id, { messages: [...result.messages, { role: 'assistant', content: reply, model: MODELS.fast }] }); if (updated) assign(updated); setView('preview');
      }
      setPanel('workspace');
    } catch (e) { setError(abort.signal.aborted ? 'কাজ বন্ধ করা হয়েছে; source অপরিবর্তিত আছে।' : (e as Error).message); }
    finally { setBusy(false); setStreaming(''); ctrl.current = null; }
  };
  const html = project.kind === 'html' ? files['index.html'] ?? project.html : '';
  const currentRevision = project.revisions?.at(-1), previousRevision = project.revisions?.at(-2);
  const changes = currentRevision ? fileChanges(previousRevision?.files ?? {}, currentRevision.files) : [];
  const viewItems = [['preview', Eye, 'প্রিভিউ'], ['files', Files, 'ফাইল'], ['logs', Terminal, 'লগ'], ['tools', Wrench, 'টুল'], ['history', History, 'ইতিহাস']] as const;
  return <div className="studio-shell flex h-dvh flex-col overflow-hidden bg-background">
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card/60 px-3">
      <Button asChild variant="ghost" size="icon" title="প্রজেক্টে ফিরে যান"><Link to="/dashboard" aria-label="ফিরে যান"><ArrowLeft /></Link></Button>
      <div className="hidden sm:block"><Logo /></div><div className="min-w-0"><p className="truncate text-sm font-semibold">{project.name}</p><p className="text-[10px] text-muted-foreground">{project.kind === 'next' ? 'Next.js · App Router' : 'HTML · স্থানীয় প্রিভিউ'}</p></div>
      <div className="ml-auto flex shrink-0 items-center gap-1"><div className="hidden xl:block"><StatusDot /></div><Button variant="ghost" size="icon" aria-label="ZIP ডাউনলোড" title="Source ZIP ডাউনলোড" disabled={!Object.keys(files).length} onClick={() => downloadSource(files, project.slug)}><Download /></Button><Button size="sm" onClick={() => setPublishOpen(true)}><Globe /><span className="hidden min-[400px]:inline">পাবলিশ</span></Button></div>
    </header>
    <div className="flex min-h-0 flex-1">
      <aside className={`${panel === 'chat' ? 'flex' : 'hidden'} w-full min-w-0 flex-col border-r bg-card/30 lg:flex lg:w-[360px] lg:shrink-0`}>
        <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4 text-xs"><Bot className="h-4 w-4 text-primary" /><span className="font-semibold">NextBuild Agent</span><span className="ml-auto text-muted-foreground">২টি মডেল</span></div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {!project.messages.length && <div className="py-8"><Sparkles className="mb-4 h-7 w-7 text-primary" /><h1 className="mb-2 text-xl font-semibold">কী তৈরি করতে চান?</h1><p className="text-sm text-muted-foreground">আপনার অ্যাপের অনুরোধ লিখুন।</p><div className="mt-5 flex flex-col items-start gap-2">{['একটি inventory app বানাও', 'বাংলা portfolio website বানাও', 'একটি task manager বানাও'].map(text => <Button key={text} variant="outline" size="sm" onClick={() => setInput(text)}>{text}</Button>)}</div></div>}
          {project.messages.map((m, i) => <div key={i} className={m.role === 'user' ? 'ml-5 rounded-md bg-secondary px-3 py-2 text-sm whitespace-pre-wrap break-words' : 'min-w-0 space-y-1'}>{m.role === 'assistant' && <p className="text-[10px] text-primary">NextBuild · {m.model ?? 'Agent'}</p>}{m.role === 'user' ? m.content : <RichText text={m.content} />}</div>)}
          {liveRun && <div className="space-y-2 border-l-2 border-primary pl-3"><p className="text-xs font-semibold">{liveRun.summary}</p>{liveRun.tasks.map(task => <div key={task.id} className="flex items-start gap-2 text-xs">{task.state === 'running' ? <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-primary" /> : task.state === 'completed' ? <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-success" /> : <Clock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />}<span className="min-w-0 flex-1 break-words">{task.role}</span><span className="text-muted-foreground">{taskNames[task.state]}</span></div>)}</div>}
          {busy && <p className="flex items-center gap-2 text-xs text-primary"><Loader2 className="h-3 w-3 animate-spin" />{liveRun?.state === 'planning' ? 'পরিকল্পনা তৈরি হচ্ছে…' : 'এজেন্ট কাজ করছে…'}</p>}
          {busy && streaming && <p className="max-h-24 overflow-hidden break-all font-mono text-[10px] text-muted-foreground">{streaming.slice(-700)}</p>}
          {error && <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="h-4 w-4 shrink-0" /><span className="break-words">{error}</span></div>}<div ref={bottom} />
        </div>
        <div className="shrink-0 space-y-2 border-t p-3">
          <select aria-label="এজেন্ট মোড" value={mode} disabled={busy} onChange={e => setMode(e.target.value as 'agents' | 'html')} className="h-8 w-full rounded-md border bg-card px-2 text-xs"><option value="agents">Master + Planner + Subagents · Next.js</option><option value="html">একক Coder · HTML</option></select>
          <PromptSuggestions value={input} busy={busy} enabled={suggestions} setEnabled={setSuggestions} accept={setInput} />
          <div className="flex items-end gap-2 rounded-md border bg-card p-2"><textarea aria-label="অ্যাপের অনুরোধ" rows={3} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="আপনার অ্যাপের অনুরোধ লিখুন…" className="min-w-0 flex-1 resize-none bg-transparent text-sm outline-none" />{busy ? <Button variant="destructive" size="icon" aria-label="থামান" onClick={() => ctrl.current?.abort()}><Square /></Button> : <Button size="icon" aria-label="পাঠান" disabled={!input.trim()} onClick={() => void send()}><Send /></Button>}</div>
        </div>
      </aside>
      <main className={`${panel === 'workspace' ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col lg:flex`}>
        <nav className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b bg-card/30 px-2" aria-label="কাজের ভিউ">{viewItems.map(([key, Icon, label]) => <Button key={key} variant={view === key ? 'secondary' : 'ghost'} size="sm" onClick={() => setView(key)}><Icon /><span className="hidden sm:inline">{label}</span><span className="sr-only sm:hidden">{label}</span></Button>)}<span className="ml-auto hidden whitespace-nowrap px-2 font-mono text-[10px] text-muted-foreground sm:inline">{Object.keys(files).length} files</span></nav>
        {view === 'files' && <div className="flex min-h-0 flex-1">
          <aside className="flex w-36 shrink-0 flex-col border-r bg-card/20 sm:w-48"><div className="flex h-10 shrink-0 items-center px-2 text-[10px] font-semibold text-muted-foreground"><span className="mr-auto">EXPLORER</span><Button variant="ghost" size="icon" disabled={busy} aria-label="নতুন ফাইল" title="নতুন ফাইল" onClick={() => fileAction('create')}><Plus /></Button></div><div className="flex items-center gap-1 border-b px-2 pb-2"><Search className="h-3 w-3 shrink-0 text-muted-foreground" /><input aria-label="ফাইল অনুসন্ধান" value={filter} onChange={e => setFilter(e.target.value)} className="min-w-0 w-full bg-transparent text-xs outline-none" placeholder="অনুসন্ধান" /></div><div className="min-h-0 flex-1 overflow-auto py-1">{Object.keys(files).sort().filter(path => path.toLowerCase().includes(filter.toLowerCase()) || files[path]?.toLowerCase().includes(filter.toLowerCase())).map(path => <Button key={path} variant={selected === path ? 'secondary' : 'ghost'} className="h-auto min-h-8 w-full justify-start rounded-none px-2 py-1.5 text-[10px]" title={path} onClick={() => openFile(path)}><FileCode2 className="h-3 w-3" /><span className="truncate">{path}</span></Button>)}</div><div className="flex shrink-0 justify-end border-t p-1"><Button variant="ghost" size="icon" disabled={!selected || busy} aria-label="ফাইলের নাম বদলান" title="ফাইলের নাম বদলান" onClick={() => fileAction('rename')}><Pencil /></Button><Button variant="ghost" size="icon" disabled={!selected || busy} aria-label="ফাইল মুছুন" title="ফাইল মুছুন" onClick={() => fileAction('delete')}><Trash2 /></Button></div></aside>
          <section className="flex min-w-0 flex-1 flex-col"><div className="flex h-9 shrink-0 overflow-x-auto border-b">{tabs.filter(path => files[path] !== undefined).map(path => <div key={path} className={`flex shrink-0 items-center border-r ${selected === path ? 'bg-card' : ''}`}><Button variant="ghost" size="sm" className="rounded-none text-[10px]" onClick={() => openFile(path)}>{path.split('/').at(-1)}</Button><Button variant="ghost" size="icon" className="h-6 w-5" aria-label={`${path} ট্যাব বন্ধ`} onClick={() => { if (path === selected && !protectDraft()) return; setTabs(old => old.filter(t => t !== path)); if (selected === path) { setSelected(''); setDraft(''); } }}><X className="h-3 w-3" /></Button></div>)}</div>{selected ? <SourceEditor path={selected} value={draft} onChange={setDraft} onSave={saveDraft} dirty={dirty} /> : <Empty icon={Files} title="কোনো ফাইল খোলা নেই" action={<Button variant="outline" onClick={template}>Next.js starter</Button>} />}</section>
        </div>}
        {view === 'preview' && <><div className="flex h-11 shrink-0 items-center gap-1 border-b px-3"><div className="flex items-center gap-1">{([['desktop', Monitor, 'Desktop'], ['tablet', Tablet, 'Tablet'], ['mobile', Smartphone, 'Mobile']] as const).map(([key, Icon, label]) => <Button key={key} variant={device === key ? 'secondary' : 'ghost'} size="icon" aria-label={label} title={label} onClick={() => setDevice(key)}><Icon /></Button>)}</div><span className="ml-auto hidden text-xs text-muted-foreground sm:block">{html ? 'HTML preview' : 'Next.js runner প্রয়োজন'}</span><Button variant="ghost" size="icon" aria-label="প্রিভিউ রিফ্রেশ" title="প্রিভিউ রিফ্রেশ" onClick={() => setFrameKey(k => k + 1)}><RefreshCw /></Button></div><div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-muted/30 p-3">{html ? <iframe key={frameKey} title="অ্যাপ প্রিভিউ" srcDoc={html} sandbox="allow-scripts allow-forms allow-modals" className={`h-full w-full border bg-card ${device === 'mobile' ? 'max-w-[390px]' : device === 'tablet' ? 'max-w-[768px]' : ''}`} /> : <Empty icon={Code2} title={project.kind === 'next' ? 'Next.js source প্রস্তুত' : 'আপনার অ্যাপের স্টুডিও'} text={project.kind === 'next' ? 'প্রকৃত প্রিভিউ চালাতে isolated VPS runner সংযোগ প্রয়োজন।' : 'Next.js starter দিয়ে শুরু করুন অথবা চ্যাটে আপনার অনুরোধ লিখুন।'} action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={project.kind === 'next' ? () => setView('files') : template}><Files />{project.kind === 'next' ? 'ফাইল খুলুন' : 'Next.js starter'}</Button><Button variant="outline" onClick={() => setView('tools')}><Wrench />সংযোগ</Button></div>} />}</div></>}
        {view === 'logs' && <div className="min-h-0 flex-1 overflow-auto p-5"><h2 className="mb-4 text-sm font-semibold">কাজের লগ</h2><div className="mb-4 border-l-2 border-warning pl-3 text-xs text-warning">VPS runner যুক্ত নেই। এখানে source এজেন্টের log দেখা যায়; এগুলো compiler বা test result নয়।</div>{(project.runs ?? []).slice().reverse().map(run => <section key={run.id} className="mb-6 space-y-2"><p className="text-xs text-primary">{run.goal} · {run.state}</p>{run.logs.map((log, i) => <p key={i} className="break-words font-mono text-xs text-muted-foreground">{log}</p>)}</section>)}{!project.runs?.length && <p className="text-xs text-muted-foreground">কোনো agent run নেই।</p>}</div>}
        {view === 'tools' && <div className="min-h-0 flex-1 overflow-auto p-5"><h2 className="mb-5 text-lg font-semibold">টুল সংযোগ</h2><div className="grid gap-3 xl:grid-cols-2">{TOOL_SERVICES.map(tool => <article key={tool.id} className="rounded-md border bg-card/30 p-3"><div className="flex items-start gap-2"><Wrench className="mt-1 h-4 w-4 text-muted-foreground" /><h3 className="flex-1 text-sm font-semibold">{tool.name}</h3><span className={`text-[10px] ${tool.status === 'local' ? 'text-success' : 'text-warning'}`}>{tool.status === 'local' ? 'প্রস্তুত' : 'সংযোগ বাকি'}</span></div><p className="mt-2 text-xs text-muted-foreground">{tool.detail}</p>{tool.status === 'local' && <Button variant="link" size="sm" onClick={() => setView('files')}>ফাইল খুলুন</Button>}</article>)}</div></div>}
        {view === 'history' && <div className="min-h-0 flex-1 overflow-auto p-5"><h2 className="mb-4 text-lg font-semibold">সংস্করণ ইতিহাস</h2>{currentRevision && <div className="mb-5 space-y-1"><p className="mb-2 text-xs text-muted-foreground">সর্বশেষ পরিবর্তন</p>{changes.map(c => <p key={c.path} className="font-mono text-xs"><span className="mr-2 text-primary">{c.kind === 'added' ? '+' : c.kind === 'deleted' ? '−' : '~'}</span>{c.path}</p>)}</div>}{(project.revisions ?? []).slice().reverse().map(revision => <div key={revision.id} className="flex flex-wrap items-center gap-3 border-t py-3"><div className="min-w-0 flex-1"><p className="text-sm">{revision.label}</p><p className="text-[10px] text-muted-foreground">{new Date(revision.createdAt).toLocaleString('bn-BD')} · {Object.keys(revision.files).length} files</p></div><Button variant="outline" size="sm" disabled={busy || currentRevision?.id === revision.id} onClick={() => { if (!protectDraft() || !confirm('এই সংস্করণ ফিরিয়ে আনবেন?')) return; const restored = restoreRevision(id, revision.id); assign(restored); setSelected(''); setDraft(''); setTabs([]); }}>ফিরিয়ে আনুন</Button></div>)}{!project.revisions?.length && <p className="text-xs text-muted-foreground">এখনো কোনো সংরক্ষিত সংস্করণ নেই।</p>}</div>}
      </main>
    </div>
    <footer className="flex h-11 shrink-0 items-center border-t bg-card px-2 lg:h-7"><div className="flex w-full gap-1 lg:hidden"><Button size="sm" variant={panel === 'chat' ? 'secondary' : 'ghost'} className="flex-1" onClick={() => setPanel('chat')}><Bot />চ্যাট</Button><Button size="sm" variant={panel === 'workspace' ? 'secondary' : 'ghost'} className="flex-1" onClick={() => setPanel('workspace')}><Files />স্টুডিও</Button></div><p className="hidden text-[10px] text-muted-foreground lg:block">{busy ? 'এজেন্ট সক্রিয়' : 'স্থানীয় source সংরক্ষণ'} · {project.kind === 'next' ? 'Next.js' : 'HTML'} · {Object.keys(files).length} files</p><p className="ml-auto hidden text-[10px] text-warning lg:block">Runner সংযোগ বাকি</p></footer>
    {publishOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"><section role="dialog" aria-modal="true" aria-label="প্রকাশের অবস্থা" className="w-full max-w-md rounded-md border bg-card p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">পাবলিক প্রকাশ</h2><Button variant="ghost" size="icon" aria-label="বন্ধ করুন" onClick={() => setPublishOpen(false)}><X /></Button></div><p className="my-4 text-sm text-warning">Shared artifact host এবং VPS runner এখনো যুক্ত নেই।</p><p className="mb-4 text-sm text-muted-foreground">এই browser-এর source দিয়ে অন্য দর্শকের জন্য কাজ করা public link তৈরি হবে না। Source ZIP ডাউনলোড করতে পারেন।</p><Button disabled={!Object.keys(files).length} onClick={() => downloadSource(files, project.slug)}><Download />Source ZIP</Button><Button variant="outline" className="ml-2" onClick={() => { setPublishOpen(false); setView('tools'); setPanel('workspace'); }}>সংযোগ দেখুন</Button><div className="mt-4 border-t pt-3"><Button variant="ghost" size="sm" onClick={async () => { await navigator.clipboard.writeText('/p/' + project.slug); setCopied(true); }}><Globe />{copied ? 'পথ কপি হয়েছে (লাইভ নয়)' : '/p/' + project.slug + ' (লাইভ নয়)'}</Button></div></section></div>}
  </div>;
}
function Empty({ icon: Icon, title, text, action }: { icon: typeof Files; title: string; text?: string; action?: React.ReactNode }) {
  return <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 overflow-auto px-4 py-8 text-center"><div className="studio-empty-mark flex h-16 w-16 shrink-0 items-center justify-center rounded-md border text-primary"><Icon className="h-7 w-7" /></div><h2 className="text-xl font-semibold">{title}</h2>{text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}{action}</div>;
}

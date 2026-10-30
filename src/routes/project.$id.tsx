import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bot, Code2, Eye, Globe, Loader2, RefreshCw, Send, Square, Files, Plus, Pencil, Trash2, Download, Monitor, Tablet, Smartphone, Terminal, Wrench, History, FileCode2, Search, X, Sparkles, Settings, CheckCircle2, Clock, AlertCircle, Paperclip, ImagePlus, Lightbulb, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo, StatusDot } from '@/components/StatusDot';
import { RichText } from '@/components/CodeBlock';
import { SourceEditor } from '@/components/studio/SourceEditor';
import { PromptSuggestions } from '@/components/studio/PromptSuggestions';
import { getProject, updateProject, saveProjectFiles, editProjectFiles, restoreRevision, type Project, type ChatMsg } from '@/lib/store';
import { extractHtml, MODELS, streamChat, SYSTEM_PROMPT, uploadImage, generateImage, withFallback } from '@/lib/ai';
import { bundleHtml } from '@/lib/project/bundle';
import { ProviderSettings } from '@/components/studio/ProviderSettings';
import { publishApp } from '@/lib/publish.functions';
import { currentUser } from '@/lib/store';
import { buildWithAgents } from '@/lib/agents/run';
import type { RunRecord } from '@/lib/agents/contracts';
import { htmlTemplate } from '@/lib/project/template';
import { contentHash, fileChanges } from '@/lib/project/files';
import { downloadSource } from '@/lib/project/export';
import { TOOL_SERVICES } from '@/lib/services';
import { runScript, SHELL_AGENT_PROMPT } from '@/lib/project/shell';
import { testFiles } from '@/lib/project/bundle';
import { WorkSteps, runSteps, commandStep, type Step } from '@/components/studio/WorkSteps';
type Attach = { images: string[]; texts: { name: string; content: string }[] };
const TEXT_EXT = /\.(txt|md|json|csv|html?|css|js|jsx|ts|tsx|xml|ya?ml|svg)$/i;
type TermLine = { who: 'user' | 'agent'; cmd: string; output: string; error?: boolean };

export const Route = createFileRoute('/project/$id')({
  head: () => ({ meta: [{ title: 'NextBuild Studio — বাংলা মাল্টি-ফাইল অ্যাপ বিল্ডার' }, { name: 'description', content: 'ফাইল সম্পাদনা, পরিকল্পনাভিত্তিক এজেন্ট, বাংলা চ্যাট এবং অ্যাপ প্রিভিউ।' }, { property: 'og:title', content: 'NextBuild Studio — অ্যাপ বিল্ডার' }, { property: 'og:description', content: 'বাংলা চ্যাট ও মাল্টি-ফাইল অ্যাপ স্টুডিও।' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }), component: Builder,
});
type View = 'preview' | 'files' | 'terminal' | 'logs' | 'tools' | 'history';
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
  const [publishOpen, setPublishOpen] = useState(false), [copied, setCopied] = useState(false), [settingsOpen, setSettingsOpen] = useState(false), [publishing, setPublishing] = useState(false), [publishedUrl, setPublishedUrl] = useState('');
  const [term, setTerm] = useState<TermLine[]>([]), [cmd, setCmd] = useState('');
  const [attach, setAttach] = useState<Attach>({ images: [], texts: [] }), [uploading, setUploading] = useState(false), [imaging, setImaging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [cmdSteps, setCmdSteps] = useState<Step[]>([]), [runView, setRunView] = useState<Step[]>([]);
  const stepsRef = useRef<Step[]>([]);
  const pushStep = (st: Step) => setCmdSteps(x => { const n = [...x, st]; stepsRef.current = [...runViewRef.current, ...n]; return n; });
  const runViewRef = useRef<Step[]>([]);
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
  const files = { ...(project.files ?? {}), ...live }, dirty = !!selected && draft !== files[selected];
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
    if (!protectDraft() || (Object.keys(files).length > 0 && !confirm('বর্তমান source বদলে HTML starter বসাবেন? পুরোনো source ইতিহাসে রাখা হবে।'))) return;
    try {
      let p = getProject(id); if (p && Object.keys(p.files ?? {}).length && !p.revisions?.length) p = saveProjectFiles(id, p.files ?? {}, 'পুরোনো source');
      const updated = saveProjectFiles(id, htmlTemplate(), 'HTML starter', 'html'); assign(updated); setSelected('index.html'); setDraft(updated.files?.['index.html'] ?? ''); setTabs(['index.html']); setView('files'); setPanel('workspace'); setError('');
    } catch (e) { setError((e as Error).message); }
  };
  const persistRun = (run: RunRecord) => {
    setLiveRun(run); const rs = runSteps(run); runViewRef.current = rs; setRunView(rs);
    const p = getProject(id); if (!p) return;
    const runs = [...(p.runs ?? []).filter(r => r.id !== run.id), run].slice(-10);
    const updated = updateProject(id, { runs }); if (updated) assign(updated);
  };
  const execScript = (script: string, who: 'user' | 'agent') => {
    const cur = getProject(id)?.files ?? {}; const { files: next, log } = runScript(cur, script);
    setTerm(t => [...t, ...log.map(l => ({ who, ...l }))].slice(-300));
    if (who === 'agent') log.forEach(l => pushStep(commandStep(l.cmd, l.output, l.error)));
    if (next !== cur && JSON.stringify(next) !== JSON.stringify(cur)) { const p = saveProjectFiles(id, next, who === 'agent' ? 'কমান্ড এজেন্ট' : 'টার্মিনাল', 'html'); assign(p); setSelected(s => next[s] !== undefined ? s : ''); setDraft(d => next[selected] ?? d); }
    return log;
  };
  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return; setUploading(true); setError('');
    try {
      for (const f of Array.from(list).slice(0, 6)) {
        if (f.type.startsWith('image/')) { const url = await uploadImage(f); setAttach(a => ({ ...a, images: [...a.images, url].slice(0, 6) })); }
        else if (TEXT_EXT.test(f.name) && f.size < 400_000) { const content = await f.text(); setAttach(a => ({ ...a, texts: [...a.texts, { name: f.name, content: content.slice(0, 20000) }].slice(0, 6) })); }
        else throw new Error(`${f.name}: শুধু ছবি বা লেখা-ফাইল (txt, md, json, csv, html, css, js…) দেওয়া যাবে।`);
      }
    } catch (e) { setError((e as Error).message); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  };
  const makeImage = async (kind: 'image' | 'icon' | 'audio' = 'image') => {
    const prompt = input.trim(); if (!prompt || imaging || busy) return;
    setImaging(true); setError('');
    try {
      const url = await generateImage(prompt, undefined, kind);
      const p0 = getProject(id); if (!p0) return;
      const label = kind === 'audio' ? '🔊 অডিও বানাও: ' : kind === 'icon' ? '✨ আইকন বানাও: ' : '🎨 ছবি বানাও: ';
      const reply: ChatMsg = kind === 'audio' ? { role: 'assistant', content: 'অডিও তৈরি হয়েছে! প্রজেক্টে সংরক্ষিত — পরের অনুরোধে এজেন্ট এটি অ্যাপে ব্যবহার করতে পারবে।', model: 'Lovable AI · অডিও', audio: url } : { role: 'assistant', content: `${kind === 'icon' ? 'আইকন' : 'ছবি'} তৈরি হয়েছে! এটি প্রজেক্টে সংরক্ষিত — পরের অনুরোধে এজেন্ট এটি অ্যাপে ব্যবহার করতে পারবে।`, model: `Lovable AI · ${kind === 'icon' ? 'আইকন' : 'ছবি'}`, images: [url] };
      const updated = updateProject(id, { assets: [...(p0.assets ?? []), (kind === 'audio' ? 'audio: ' : kind === 'icon' ? 'icon: ' : '') + url].slice(-20), messages: [...p0.messages, { role: 'user', content: label + prompt }, reply] });
      if (updated) assign(updated); setInput('');
    } catch (e) { setError((e as Error).message); }
    finally { setImaging(false); }
  };
  const suggestNext = async (goal: string) => {
    try {
      const out = await streamChat({ role: 'fast', system: 'তুমি NextBuild অ্যাপ সাজেশন এজেন্ট। তৈরি অ্যাপের জন্য পরের ৩টি উন্নতির অনুরোধ বাংলায় দাও, প্রতিটি এক লাইনে, সর্বোচ্চ ৬০ অক্ষর। শুধু ৩ লাইন, নম্বর বা চিহ্ন নয়।', messages: [{ role: 'user', content: goal }], onToken: () => {} });
      const list = out.split('\n').map(l => l.replace(/^[\s\d.\-*•)]+/, '').trim()).filter(l => l.length > 3).slice(0, 3);
      const u = updateProject(id, { suggestions: list }); if (u) assign(u);
    } catch { /* optional */ }
  };
  const send = async () => {
    const goal = input.trim(); if (!goal || busy || uploading || !protectDraft()) return;
    const att = attach, imgs = att.images;
    const memory = (latest.current?.messages ?? []).slice(-8).map(m => `${m.role === 'user' ? 'ব্যবহারকারী' : 'এজেন্ট'}: ${m.content.replace(/```[\s\S]*?```/g, '[কোড]').slice(0, 500)}`).join('\n');
    const fileNotes = att.texts.map(t => `--- সংযুক্ত ফাইল: ${t.name}\n${t.content}`).join('\n');
    const fullGoal = goal + (fileNotes ? '\n\n' + fileNotes : '');
    const assets = latest.current?.assets ?? [];
    setBusy(true); setError(''); setStreaming(''); setCmdSteps([]); setRunView([]); runViewRef.current = []; stepsRef.current = [];
    const abort = new AbortController(); ctrl.current = abort;
    try {
      const userMsg: ChatMsg = { role: 'user', content: goal + (att.texts.length ? `\n📎 ${att.texts.map(t => t.name).join(', ')}` : ''), ...(imgs.length ? { images: imgs } : {}) };
      const p = updateProject(id, { messages: [...(latest.current?.messages ?? []), userMsg] }); if (p) assign(p);
      setInput(''); setAttach({ images: [], texts: [] }); { const u = updateProject(id, { suggestions: [] }); if (u) assign(u); }
      const hasApp = !!bundleHtml(files);
      if (mode === 'agents' && hasApp) {
        setView('preview');
        const list = Object.entries(files).map(([p, c]) => `--- ${p}\n${c.slice(0, 14000)}`).join('\n').slice(0, 40000);
        let full = '';
        const convo: ChatMsg[] = [{ role: 'user', content: `অনুরোধ: ${fullGoal}\n${memory ? 'চ্যাট মেমরি:\n' + memory + '\n' : ''}${[...imgs, ...assets].length ? 'imageLinks:\n' + [...imgs, ...assets].join('\n') + '\n' : ''}বর্তমান ফাইল:\n${list || '(খালি প্রজেক্ট)'}` }];
        let reply = '', log: { cmd: string; output: string; error?: boolean }[] = [];
        for (let round = 0; round < 4; round++) {
        reply = await withFallback(async attempt => { full = ''; const r = await streamChat({ attempt, role: 'coder', system: SHELL_AGENT_PROMPT, messages: [...convo], images: imgs, signal: abort.signal, onProvider: label => { setTerm(t => [...t, { who: 'agent', cmd: 'model', output: label }]); pushStep(commandStep('model', label)); }, onToken: t => { full += t; setStreaming(full); } }); if (!/```(?:sh|bash|shell)?\n[\s\S]*?```/.test(r)) throw new Error('এজেন্ট কোনো কমান্ড দেয়নি।'); return r; }, abort.signal, 6, n => pushStep({ id: crypto.randomUUID(), kind: 'error', title: `উত্তরে কমান্ড ছিল না — অন্য মডেলে আবার চেষ্টা #${n}` }));
        const script = [...reply.matchAll(/```(?:sh|bash|shell)?\n([\s\S]*?)```/g)].map(m => m[1]).join('\n');
        const roundLog = execScript(script, 'agent'); log = [...log, ...roundLog];
        const edits = roundLog.some(l => /^(write|append|replace|rm|mv|touch)\b/.test(l.cmd));
        if ((edits && !roundLog.some(l => l.error)) || round === 3) break;
        // Only read (or failed): feed the terminal output back so the agent continues, like a real session.
        convo.push({ role: 'assistant', content: reply }, { role: 'user', content: 'টার্মিনাল আউটপুট:\n' + roundLog.map(l => `$ ${l.cmd}\n${l.output.slice(0, 6000)}`).join('\n').slice(0, 24000) + '\nএখন প্রয়োজনীয় পরিবর্তন write/replace দিয়ে করো, তারপর test ও build চালাও।' });
        }
        const failed = log.find(l => l.error);
        const after = getProject(id)?.files ?? {}, issues = testFiles(after);
        pushStep(commandStep('test', issues.length ? '✗ ' + issues.join('\n✗ ') : '✓ সব স্ট্যাটিক টেস্ট পাস', issues.length > 0)); pushStep(commandStep('build', bundleHtml(after) ? '✓ বিল্ড সফল' : '✗ বিল্ড হয়নি', !bundleHtml(after)));
        setTerm(t => [...t, { who: 'agent', cmd: 'test', output: issues.length ? '✗ ' + issues.join('\n✗ ') : '✓ সব স্ট্যাটিক টেস্ট পাস' }, { who: 'agent', cmd: 'build', output: bundleHtml(after) ? '✓ বিল্ড সফল — প্রিভিউ আপডেট' : '✗ বিল্ড হয়নি', error: !bundleHtml(after) }]);
        const note = (reply.split('```')[0] ?? '').trim() || 'কমান্ড চালানো হয়েছে।';
        const mini = log.slice(0, 12).map(l => `$ ${l.cmd}\n  ${l.output.split('\n')[0]?.slice(0, 120)}`).join('\n');
        const updated = updateProject(id, { messages: [...(getProject(id)?.messages ?? []), { role: 'assistant', content: `${note}\n\n\`\`\`sh\n${mini}\n\`\`\`\n${log.length}টি কমান্ড চলেছে${failed ? ` — ত্রুটি: ${failed.output}` : ' ✓'}${issues.length ? ` · ${issues.length}টি টেস্ট সমস্যা` : ' · টেস্ট ও বিল্ড পাস'}।`, model: 'কমান্ড এজেন্ট', steps: stepsRef.current }] }); if (updated) assign(updated);
        setView('preview'); void suggestNext(goal);
      } else if (mode === 'agents') {
        setView('preview');
        const base: typeof files = { ...files };
        const { files: generated } = await buildWithAgents(fullGoal, base, abort.signal, persistRun, value => setStreaming(value), { images: imgs, memory, assets, onLive: (path, content) => { setLive(l => ({ ...l, [path]: content })); setSelected(path); setDraft(content); setTabs(t => t.includes(path) ? t : [...t, path]); setView('files'); }, onDraft: draft => { setLive({}); setView('preview'); assign(saveProjectFiles(id, draft, 'এজেন্ট খসড়া', 'html')); setFrameKey(k => k + 1); } });
        const result = saveProjectFiles(id, generated, 'এজেন্ট আপডেট', 'html');
        setTerm(t => [...t, ...fileChanges(base, generated).map(c => ({ who: 'agent' as const, cmd: `${c.kind === 'deleted' ? 'rm' : 'write'} ${c.path}`, output: c.kind === 'added' ? '+ নতুন ফাইল' : c.kind === 'deleted' ? '− মুছে ফেলা' : '~ পরিবর্তিত' })), { who: 'agent', cmd: 'build', output: '✓ বিল্ড ও টেস্ট শেষ' }]);
        const updated = updateProject(id, { messages: [...result.messages, { role: 'assistant', content: `কাজ শেষ! ${Object.keys(generated).length}টি ফাইল তৈরি, মান যাচাই ও টেস্ট হয়েছে। প্রিভিউ দেখুন, তারপর পাবলিশ করুন।`, model: MODELS.fast, steps: [...runViewRef.current, ...fileChanges(base, generated).map(c => commandStep(c.kind === 'deleted' ? 'rm ' + c.path : 'write ' + c.path, c.kind))] }] }); if (updated) assign(updated);
        { const main = ['index.html'].find(f => generated[f] !== undefined) ?? Object.keys(generated)[0] ?? ''; setSelected(main); setDraft(generated[main] ?? ''); setTabs(main ? [main] : []); } setView('preview'); setFrameKey(k => k + 1); void suggestNext(goal);
      } else {
        let full = '';
        const reply = await withFallback(async attempt => { full = ''; const r = await streamChat({ attempt, role: 'coder', system: SYSTEM_PROMPT, messages: [{ role: 'user', content: fullGoal + (memory ? '\nচ্যাট মেমরি:\n' + memory : '') + ([...imgs, ...assets].length ? '\nব্যবহারযোগ্য ছবির লিংক:\n' + [...imgs, ...assets].join('\n') : '') + (files['index.html'] ? '\nCurrent HTML:\n' + files['index.html'].slice(0, 6500) : '') }], images: imgs, signal: abort.signal, onToken: token => { full += token; setStreaming(full); } }); if (!extractHtml(r)) throw new Error('সম্পূর্ণ HTML পাওয়া যায়নি'); return r; }, abort.signal, 6, n => setStreaming(`অন্য মডেলে আবার চেষ্টা #${n}…`));
        const html = extractHtml(reply); if (!html) throw new Error('সম্পূর্ণ HTML পাওয়া যায়নি; source অপরিবর্তিত আছে।');
        const result = saveProjectFiles(id, { 'index.html': html }, 'HTML agent update', 'html');
        const updated = updateProject(id, { messages: [...result.messages, { role: 'assistant', content: reply, model: MODELS.fast }] }); if (updated) assign(updated); setView('preview');
      }
      setPanel('workspace');
    } catch (e) { setError(abort.signal.aborted ? 'কাজ বন্ধ করা হয়েছে; source অপরিবর্তিত আছে।' : (e as Error).message); }
    finally { setBusy(false); setStreaming(''); ctrl.current = null; }
  };
  const html = bundleHtml(files) ?? project.html ?? '';
  const publish = async () => {
    if (!html) return; setPublishing(true); setError('');
    try {
      const owner = (currentUser()?.id ?? 'guest') + '-' + project.id; let slug = project.slug;
      let r = await publishApp({ data: { slug, name: project.name, html, ownerKey: owner } });
      if (!r.ok) { slug = `${project.slug}-${Math.random().toString(36).slice(2, 6)}`; r = await publishApp({ data: { slug, name: project.name, html, ownerKey: owner } }); }
      if (!r.ok) throw new Error('এই নাম ব্যবহৃত');
      const u = updateProject(id, { slug, published: true }); if (u) assign(u);
      setPublishedUrl(`${window.location.origin}/p/${slug}`);
    } catch (e) { setError('প্রকাশ ব্যর্থ: ' + (e as Error).message); }
    finally { setPublishing(false); }
  };
  const currentRevision = project.revisions?.at(-1), previousRevision = project.revisions?.at(-2);
  const changes = currentRevision ? fileChanges(previousRevision?.files ?? {}, currentRevision.files) : [];
  const viewItems = [['preview', Eye, 'প্রিভিউ'], ['files', Files, 'ফাইল'], ['terminal', Terminal, 'টার্মিনাল'], ['logs', History, 'লগ'], ['tools', Wrench, 'টুল'], ['history', History, 'ইতিহাস']] as const;
  return <div className="studio-shell flex h-dvh flex-col overflow-hidden bg-background">
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card/60 px-3">
      <Button asChild variant="ghost" size="icon" title="প্রজেক্টে ফিরে যান"><Link to="/dashboard" aria-label="ফিরে যান"><ArrowLeft /></Link></Button>
      <div className="hidden sm:block"><Logo /></div><div className="min-w-0"><p className="truncate text-sm font-semibold">{project.name}</p><p className="text-[10px] text-muted-foreground">{project.kind === 'next' ? 'Next.js · App Router' : 'HTML · স্থানীয় প্রিভিউ'}</p></div>
      <div className="ml-auto flex shrink-0 items-center gap-1"><div className="hidden xl:block"><StatusDot /></div><Button variant="ghost" size="icon" aria-label="ZIP ডাউনলোড" title="Source ZIP ডাউনলোড" disabled={!Object.keys(files).length} onClick={() => downloadSource(files, project.slug)}><Download /></Button><Button variant="ghost" size="icon" aria-label="AI সেটিংস" title="AI প্রোভাইডার সেটিংস" onClick={() => setSettingsOpen(true)}><Settings /></Button><Button size="sm" onClick={() => setPublishOpen(true)}><Globe /><span className="hidden min-[400px]:inline">পাবলিশ</span></Button></div>
    </header>
    <div className="flex min-h-0 flex-1">
      <aside className={`${panel === 'chat' ? 'flex' : 'hidden'} w-full min-w-0 flex-col border-r bg-card/30 lg:flex lg:w-[360px] lg:shrink-0`}>
        <div className="flex h-11 shrink-0 items-center gap-2 border-b px-4 text-xs"><Bot className="h-4 w-4 text-primary" /><span className="font-semibold">NextBuild Agent</span><span className="ml-auto text-muted-foreground">অটো মাল্টি-মডেল</span></div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {!project.messages.length && <div className="py-8"><Sparkles className="mb-4 h-7 w-7 text-primary" /><h1 className="mb-2 text-xl font-semibold">কী তৈরি করতে চান?</h1><p className="text-sm text-muted-foreground">আপনার অ্যাপের অনুরোধ লিখুন।</p><div className="mt-5 flex flex-col items-start gap-2">{['একটি inventory app বানাও', 'বাংলা portfolio website বানাও', 'একটি task manager বানাও'].map(text => <Button key={text} variant="outline" size="sm" onClick={() => setInput(text)}>{text}</Button>)}</div></div>}
          {project.messages.map((m, i) => <div key={i} className={m.role === 'user' ? 'ml-5 rounded-md bg-secondary px-3 py-2 text-sm whitespace-pre-wrap break-words' : 'min-w-0 space-y-1'}>{m.role === 'assistant' && <p className="text-[10px] text-primary">NextBuild · {m.model ?? 'Agent'}</p>}{m.role === 'assistant' && m.steps?.length ? <WorkSteps steps={m.steps} open={false} /> : null}{m.role === 'user' ? m.content : <RichText text={m.content} />}{m.images?.length ? <div className="mt-2 flex flex-wrap gap-2">{m.images.map(u => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="সংযুক্ত ছবি" className="h-24 w-24 rounded-md border object-cover" /></a>)}</div> : null}{m.audio ? <audio controls src={m.audio} className="mt-2 w-full" /> : null}</div>)}
          {!busy && !!project.suggestions?.length && <div className="space-y-1"><p className="flex items-center gap-1 text-[10px] text-muted-foreground"><Lightbulb className="h-3 w-3" />পরের ধাপের সাজেশন</p><div className="flex flex-wrap gap-1">{project.suggestions.map(sg => <Button key={sg} variant="outline" size="sm" className="h-auto whitespace-normal py-1 text-left text-xs" onClick={() => setInput(sg)}>{sg}</Button>)}</div></div>}
          {busy && <WorkSteps steps={[...runView, ...cmdSteps, ...(liveRun?.state === 'planning' || (!runView.length && !cmdSteps.length) ? [] : [])]} />}
          {busy && <p className="flex items-center gap-2 text-xs text-primary"><Loader2 className="h-3 w-3 animate-spin" />{liveRun?.state === 'planning' ? 'পরিকল্পনা তৈরি হচ্ছে…' : 'এজেন্ট কাজ করছে…'}</p>}
          {busy && streaming && mode === 'html' && <p title="লাইভ আউটপুট" className="max-h-24 overflow-hidden break-all font-mono text-[10px] text-muted-foreground">{streaming.slice(-700)}</p>}
          {error && <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"><AlertCircle className="h-4 w-4 shrink-0" /><span className="break-words">{error}</span></div>}<div ref={bottom} />
        </div>
        <div className="shrink-0 space-y-2 border-t p-3">
          <select aria-label="এজেন্ট মোড" value={mode} disabled={busy} onChange={e => setMode(e.target.value as 'agents' | 'html')} className="h-8 w-full rounded-md border bg-card px-2 text-xs"><option value="agents">পূর্ণ মোড: পরিকল্পনা → প্যারালাল এজেন্ট → টার্মিনাল → মান যাচাই → টেস্ট → বিল্ড</option><option value="html">দ্রুত HTML মোড</option></select>
          {(attach.images.length > 0 || attach.texts.length > 0 || uploading) && <div className="flex flex-wrap items-center gap-2">{attach.images.map(u => <div key={u} className="relative"><img src={u} alt="সংযুক্ত ছবি" className="h-12 w-12 rounded-md border object-cover" /><button type="button" aria-label="ছবি সরান" className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground" onClick={() => setAttach(a => ({ ...a, images: a.images.filter(x => x !== u) }))}><X className="h-3 w-3" /></button></div>)}{attach.texts.map(t => <span key={t.name} className="flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-[10px]"><FileCode2 className="h-3 w-3" />{t.name}<button type="button" aria-label={`${t.name} সরান`} onClick={() => setAttach(a => ({ ...a, texts: a.texts.filter(x => x.name !== t.name) }))}><X className="h-3 w-3" /></button></span>)}{uploading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}</div>}
          <PromptSuggestions value={input} busy={busy} enabled={suggestions} setEnabled={setSuggestions} accept={setInput} />
          <div className="flex flex-col gap-1 rounded-md border bg-card p-2"><textarea aria-label="অ্যাপের অনুরোধ" rows={2} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="আপনার অ্যাপের অনুরোধ লিখুন…" className="min-h-[44px] w-full resize-none bg-transparent text-sm outline-none" /><div className="flex items-center gap-1"><div className="flex flex-1 items-center gap-0.5"><input ref={fileInput} type="file" multiple hidden accept="image/*,.txt,.md,.json,.csv,.html,.htm,.css,.js,.jsx,.ts,.tsx,.xml,.yml,.yaml,.svg" onChange={e => void addFiles(e.target.files)} /><Button variant="ghost" size="icon" aria-label="ছবি বা ফাইল যোগ করুন" title="ছবি বা ফাইল যোগ করুন" disabled={busy || uploading} onClick={() => fileInput.current?.click()}><Paperclip /></Button><Button variant="ghost" size="icon" aria-label="AI দিয়ে ছবি বানান" title="লেখা বর্ণনা থেকে AI ছবি বানান" disabled={busy || imaging || !input.trim()} onClick={() => void makeImage()}>{imaging ? <Loader2 className="animate-spin" /> : <ImagePlus />}</Button><Button variant="ghost" size="icon" aria-label="AI দিয়ে আইকন বানান" title="লেখা বর্ণনা থেকে AI আইকন বানান" disabled={busy || imaging || !input.trim()} onClick={() => void makeImage('icon')}><Sparkles /></Button><Button variant="ghost" size="icon" aria-label="AI দিয়ে অডিও বানান" title="লেখা থেকে AI কণ্ঠ/অডিও বানান" disabled={busy || imaging || !input.trim()} onClick={() => void makeImage('audio')}><Volume2 /></Button></div>{busy ? <Button variant="destructive" size="icon" aria-label="থামান" onClick={() => ctrl.current?.abort()}><Square /></Button> : <Button size="icon" aria-label="পাঠান" disabled={!input.trim()} onClick={() => void send()}><Send /></Button>}</div></div>
        </div>
      </aside>
      <main className={`${panel === 'workspace' ? 'flex' : 'hidden'} min-w-0 flex-1 flex-col lg:flex`}>
        <nav className="flex h-11 shrink-0 items-center gap-1 overflow-x-auto border-b bg-card/30 px-2" aria-label="কাজের ভিউ">{viewItems.map(([key, Icon, label]) => <Button key={key} variant={view === key ? 'secondary' : 'ghost'} size="sm" onClick={() => setView(key)}><Icon /><span className="hidden sm:inline">{label}</span><span className="sr-only sm:hidden">{label}</span></Button>)}<span className="ml-auto hidden whitespace-nowrap px-2 font-mono text-[10px] text-muted-foreground sm:inline">{Object.keys(files).length} files</span></nav>
        {view === 'files' && <div className="flex min-h-0 flex-1">
          <aside className="flex w-36 shrink-0 flex-col border-r bg-card/20 sm:w-48"><div className="flex h-10 shrink-0 items-center px-2 text-[10px] font-semibold text-muted-foreground"><span className="mr-auto">EXPLORER</span><Button variant="ghost" size="icon" disabled={busy} aria-label="নতুন ফাইল" title="নতুন ফাইল" onClick={() => fileAction('create')}><Plus /></Button></div><div className="flex items-center gap-1 border-b px-2 pb-2"><Search className="h-3 w-3 shrink-0 text-muted-foreground" /><input aria-label="ফাইল অনুসন্ধান" value={filter} onChange={e => setFilter(e.target.value)} className="min-w-0 w-full bg-transparent text-xs outline-none" placeholder="অনুসন্ধান" /></div><div className="min-h-0 flex-1 overflow-auto py-1">{Object.keys(files).sort().filter(path => path.toLowerCase().includes(filter.toLowerCase()) || files[path]?.toLowerCase().includes(filter.toLowerCase())).map(path => <Button key={path} variant={selected === path ? 'secondary' : 'ghost'} className="h-auto min-h-8 w-full justify-start rounded-none px-2 py-1.5 text-[10px]" title={path} onClick={() => openFile(path)}><FileCode2 className="h-3 w-3" /><span className="truncate">{path}</span></Button>)}</div><div className="flex shrink-0 justify-end border-t p-1"><Button variant="ghost" size="icon" disabled={!selected || busy} aria-label="ফাইলের নাম বদলান" title="ফাইলের নাম বদলান" onClick={() => fileAction('rename')}><Pencil /></Button><Button variant="ghost" size="icon" disabled={!selected || busy} aria-label="ফাইল মুছুন" title="ফাইল মুছুন" onClick={() => fileAction('delete')}><Trash2 /></Button></div></aside>
          <section className="flex min-w-0 flex-1 flex-col"><div className="flex h-9 shrink-0 overflow-x-auto border-b">{tabs.filter(path => files[path] !== undefined).map(path => <div key={path} className={`flex shrink-0 items-center border-r ${selected === path ? 'bg-card' : ''}`}><Button variant="ghost" size="sm" className="rounded-none text-[10px]" onClick={() => openFile(path)}>{path.split('/').at(-1)}</Button><Button variant="ghost" size="icon" className="h-6 w-5" aria-label={`${path} ট্যাব বন্ধ`} onClick={() => { if (path === selected && !protectDraft()) return; setTabs(old => old.filter(t => t !== path)); if (selected === path) { setSelected(''); setDraft(''); } }}><X className="h-3 w-3" /></Button></div>)}</div>{selected ? <SourceEditor path={selected} value={draft} onChange={setDraft} onSave={saveDraft} dirty={dirty} /> : <Empty icon={Files} title="কোনো ফাইল খোলা নেই" action={<Button variant="outline" onClick={template}>HTML starter</Button>} />}</section>
        </div>}
        {view === 'preview' && <><div className="flex h-11 shrink-0 items-center gap-1 border-b px-3"><div className="flex items-center gap-1">{([['desktop', Monitor, 'Desktop'], ['tablet', Tablet, 'Tablet'], ['mobile', Smartphone, 'Mobile']] as const).map(([key, Icon, label]) => <Button key={key} variant={device === key ? 'secondary' : 'ghost'} size="icon" aria-label={label} title={label} onClick={() => setDevice(key)}><Icon /></Button>)}</div><span className="ml-auto hidden text-xs text-muted-foreground sm:block">{html ? 'লাইভ প্রিভিউ' : 'এখনো কিছু তৈরি হয়নি'}</span><Button variant="ghost" size="icon" aria-label="প্রিভিউ রিফ্রেশ" title="প্রিভিউ রিফ্রেশ" onClick={() => setFrameKey(k => k + 1)}><RefreshCw /></Button></div><div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-muted/30 p-3">{html ? <iframe key={frameKey} title="অ্যাপ প্রিভিউ" srcDoc={html} sandbox="allow-scripts allow-forms allow-modals" className={`h-full w-full border bg-card ${device === 'mobile' ? 'max-w-[390px]' : device === 'tablet' ? 'max-w-[768px]' : ''}`} /> : <Empty icon={Code2} title="আপনার অ্যাপের স্টুডিও" text="চ্যাটে আপনার অ্যাপের অনুরোধ লিখুন।" action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={template}><Files />HTML starter</Button><Button variant="outline" onClick={() => setView('tools')}><Wrench />সংযোগ</Button></div>} />}</div></>}
        {view === 'terminal' && <div className="flex min-h-0 flex-1 flex-col bg-card/20 font-mono text-xs"><div className="min-h-0 flex-1 overflow-auto p-4 space-y-2">{!term.length && <p className="text-muted-foreground">NextBuild টার্মিনাল — এজেন্টের সব কমান্ড এখানে দেখা যাবে। আপনিও চালাতে পারেন। শুরু করতে <span className="text-primary">help</span> লিখুন।</p>}{term.map((l, i) => <div key={i}><p><span className={l.who === 'agent' ? 'text-primary' : 'text-success'}>{l.who === 'agent' ? 'agent' : 'you'} $</span> {l.cmd}</p><pre className={`whitespace-pre-wrap break-words pl-4 ${l.error ? 'text-destructive' : 'text-muted-foreground'}`}>{l.output.slice(0, 4000)}</pre></div>)}{busy && streaming && <pre className="whitespace-pre-wrap break-words text-muted-foreground opacity-70">{streaming.slice(-1200)}</pre>}</div><form className="flex shrink-0 items-center gap-2 border-t p-2" onSubmit={e => { e.preventDefault(); const c = cmd.trim(); if (!c) return; if (c === 'clear') setTerm([]); else execScript(c, 'user'); setCmd(''); }}><span className="text-success">$</span><input aria-label="টার্মিনাল কমান্ড" value={cmd} onChange={e => setCmd(e.target.value)} disabled={busy} placeholder="ls, cat index.html, test, build…" className="min-w-0 flex-1 bg-transparent outline-none" /><Button type="submit" size="sm" variant="secondary" disabled={busy}>চালান</Button></form></div>}
        {view === 'logs' && <div className="min-h-0 flex-1 overflow-auto p-5"><h2 className="mb-4 text-sm font-semibold">কাজের লগ</h2>{(project.runs ?? []).slice().reverse().map(run => <section key={run.id} className="mb-6 space-y-2"><p className="text-xs text-primary">{run.goal} · {run.state}</p>{run.logs.map((log, i) => <p key={i} className="break-words font-mono text-xs text-muted-foreground">{log}</p>)}</section>)}{!project.runs?.length && <p className="text-xs text-muted-foreground">কোনো agent run নেই।</p>}</div>}
        {view === 'tools' && <div className="min-h-0 flex-1 overflow-auto p-5"><h2 className="mb-5 text-lg font-semibold">টুল সংযোগ</h2><div className="grid gap-3 xl:grid-cols-2">{TOOL_SERVICES.map(tool => <article key={tool.id} className="rounded-md border bg-card/30 p-3"><div className="flex items-start gap-2"><Wrench className="mt-1 h-4 w-4 text-muted-foreground" /><h3 className="flex-1 text-sm font-semibold">{tool.name}</h3><span className={`text-[10px] ${tool.status === 'local' ? 'text-success' : 'text-warning'}`}>{tool.status === 'local' ? 'প্রস্তুত' : 'সংযোগ বাকি'}</span></div><p className="mt-2 text-xs text-muted-foreground">{tool.detail}</p>{tool.status === 'local' && <Button variant="link" size="sm" onClick={() => setView('files')}>ফাইল খুলুন</Button>}</article>)}</div></div>}
        {view === 'history' && <div className="min-h-0 flex-1 overflow-auto p-5"><h2 className="mb-4 text-lg font-semibold">সংস্করণ ইতিহাস</h2>{currentRevision && <div className="mb-5 space-y-1"><p className="mb-2 text-xs text-muted-foreground">সর্বশেষ পরিবর্তন</p>{changes.map(c => <p key={c.path} className="font-mono text-xs"><span className="mr-2 text-primary">{c.kind === 'added' ? '+' : c.kind === 'deleted' ? '−' : '~'}</span>{c.path}</p>)}</div>}{(project.revisions ?? []).slice().reverse().map(revision => <div key={revision.id} className="flex flex-wrap items-center gap-3 border-t py-3"><div className="min-w-0 flex-1"><p className="text-sm">{revision.label}</p><p className="text-[10px] text-muted-foreground">{new Date(revision.createdAt).toLocaleString('bn-BD')} · {Object.keys(revision.files).length} files</p></div><Button variant="outline" size="sm" disabled={busy || currentRevision?.id === revision.id} onClick={() => { if (!protectDraft() || !confirm('এই সংস্করণ ফিরিয়ে আনবেন?')) return; const restored = restoreRevision(id, revision.id); assign(restored); setSelected(''); setDraft(''); setTabs([]); }}>ফিরিয়ে আনুন</Button></div>)}{!project.revisions?.length && <p className="text-xs text-muted-foreground">এখনো কোনো সংরক্ষিত সংস্করণ নেই।</p>}</div>}
      </main>
    </div>
    <footer className="flex h-11 shrink-0 items-center border-t bg-card px-2 lg:h-7"><div className="flex w-full gap-1 lg:hidden"><Button size="sm" variant={panel === 'chat' ? 'secondary' : 'ghost'} className="flex-1" onClick={() => setPanel('chat')}><Bot />চ্যাট</Button><Button size="sm" variant={panel === 'workspace' ? 'secondary' : 'ghost'} className="flex-1" onClick={() => setPanel('workspace')}><Files />স্টুডিও</Button></div><p className="hidden text-[10px] text-muted-foreground lg:block">{busy ? 'এজেন্ট সক্রিয়' : 'স্থানীয় source সংরক্ষণ'} · HTML · {Object.keys(files).length} files</p><p className="ml-auto hidden text-[10px] text-muted-foreground lg:block">{project.published ? 'প্রকাশিত: /p/' + project.slug : 'অপ্রকাশিত'}</p></footer>
    {publishOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"><section role="dialog" aria-modal="true" aria-label="প্রকাশের অবস্থা" className="w-full max-w-md rounded-md border bg-card p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">পাবলিক প্রকাশ</h2><Button variant="ghost" size="icon" aria-label="বন্ধ করুন" onClick={() => setPublishOpen(false)}><X /></Button></div><p className="my-3 text-sm text-muted-foreground">{html ? 'অ্যাপটি সবার জন্য একটি লিংকে প্রকাশ হবে। পরে আবার পাবলিশ করলে একই লিংক আপডেট হবে।' : 'প্রকাশ করার মতো চালু-যোগ্য অ্যাপ নেই; আগে চ্যাটে অ্যাপ তৈরি করুন।'}</p><div className="flex flex-wrap gap-2"><Button disabled={!html || publishing} onClick={() => void publish()}>{publishing ? <Loader2 className="animate-spin" /> : <Globe />}{project.published ? 'আপডেট পাবলিশ' : 'পাবলিশ করুন'}</Button><Button variant="outline" disabled={!Object.keys(files).length} onClick={() => downloadSource(files, project.slug)}><Download />ZIP</Button></div>{(publishedUrl || project.published) && <div className="mt-4 space-y-2 border-t pt-3"><a href={publishedUrl || '/p/' + project.slug} target="_blank" rel="noreferrer" className="block break-all text-sm text-primary underline">{publishedUrl || (typeof window !== 'undefined' ? window.location.origin : '') + '/p/' + project.slug}</a><Button variant="ghost" size="sm" onClick={async () => { await navigator.clipboard.writeText(publishedUrl || window.location.origin + '/p/' + project.slug); setCopied(true); }}>{copied ? 'কপি হয়েছে' : 'লিংক কপি করুন'}</Button></div>}{error && <p className="mt-2 text-xs text-destructive">{error}</p>}</section></div>}
    {settingsOpen && <ProviderSettings onClose={() => setSettingsOpen(false)} />}
  </div>;
}
function Empty({ icon: Icon, title, text, action }: { icon: typeof Files; title: string; text?: string; action?: React.ReactNode }) {
  return <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-4 overflow-auto px-4 py-8 text-center"><div className="studio-empty-mark flex h-16 w-16 shrink-0 items-center justify-center rounded-md border text-primary"><Icon className="h-7 w-7" /></div><h2 className="text-xl font-semibold">{title}</h2>{text && <p className="max-w-sm text-sm text-muted-foreground">{text}</p>}{action}</div>;
}

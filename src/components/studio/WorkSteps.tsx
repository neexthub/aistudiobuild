import { useState } from 'react';
import { Brain, ChevronRight, CircleAlert, CircleCheck, Cpu, FileSearch, FilePen, Loader2, SquareTerminal, ShieldCheck } from 'lucide-react';
import type { RunRecord } from '@/lib/agents/contracts';

export type Step = { id: string; kind: 'think' | 'read' | 'edit' | 'run' | 'model' | 'check' | 'error'; title: string; detail?: string; live?: boolean };

const ICONS = { think: Brain, read: FileSearch, edit: FilePen, run: SquareTerminal, model: Cpu, check: ShieldCheck, error: CircleAlert };

/** Turns an agent run into Lovable-style step rows. */
export function runSteps(run: RunRecord): Step[] {
  const out: Step[] = [{ id: run.id + '-plan', kind: 'think', title: run.state === 'planning' ? 'পরিকল্পনা করছে…' : `পরিকল্পনা: ${run.summary}`, live: run.state === 'planning' }];
  for (const t of run.tasks) out.push({ id: run.id + t.id, kind: t.state === 'failed' ? 'error' : 'edit', title: `${t.state === 'running' ? 'লিখছে' : t.state === 'completed' ? 'লিখেছে' : t.state === 'failed' ? 'ব্যর্থ' : 'অপেক্ষায়'} · ${t.writePaths.join(', ')}`, detail: `${t.role}: ${t.objective}`, live: t.state === 'running' });
  run.logs.forEach((l, i) => {
    const kind: Step['kind'] = l.includes('→') ? 'model' : /মান যাচাই|টেস্ট/.test(l) ? 'check' : /বিল্ড/.test(l) ? 'run' : /ব্যর্থ|ত্রুটি|আবার চেষ্টা/.test(l) ? 'error' : 'think';
    out.push({ id: `${run.id}-log${i}`, kind, title: l.split('\n')[0]!.slice(0, 110), ...(l.length > 110 || l.includes('\n') ? { detail: l } : {}) });
  });
  if (run.state === 'reviewing') out.push({ id: run.id + '-rev', kind: 'check', title: run.summary, live: true });
  return out;
}

export function commandStep(cmd: string, output: string, error?: boolean): Step {
  const c = cmd.split(/\s+/)[0] ?? '';
  const kind: Step['kind'] = error ? 'error' : ['cat', 'ls', 'tree', 'grep'].includes(c) ? 'read' : ['test', 'build'].includes(c) ? 'run' : c === 'model' ? 'model' : 'edit';
  const label = c === 'cat' ? 'পড়েছে' : c === 'grep' ? 'খুঁজেছে' : c === 'write' ? 'লিখেছে' : c === 'replace' ? 'সম্পাদনা' : c === 'rm' ? 'মুছেছে' : c === 'test' ? 'টেস্ট' : c === 'build' ? 'বিল্ড' : c === 'model' ? 'মডেল' : c;
  return { id: crypto.randomUUID(), kind, title: `${label} ${c === 'model' ? output : cmd.split(/\s+/).slice(1).join(' ')}`.trim(), detail: `$ ${cmd}\n${output}` };
}

export function WorkSteps({ steps, open: startOpen = true }: { steps: Step[]; open?: boolean }) {
  const [open, setOpen] = useState(startOpen), [expanded, setExpanded] = useState<string | null>(null);
  if (!steps.length) return null;
  const live = steps.some(s => s.live);
  return <div className="rounded-md border bg-card/40 text-xs">
    <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => setOpen(o => !o)} aria-expanded={open}>
      {live ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> : <CircleCheck className="h-3.5 w-3.5 text-success" />}
      <span className="font-semibold">{live ? 'এজেন্ট কাজ করছে' : 'কাজের ধাপ'}</span><span className="text-muted-foreground">{steps.length}টি ধাপ</span>
      <ChevronRight className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`} />
    </button>
    {open && <ul className="max-h-72 space-y-0.5 overflow-y-auto border-t px-1 py-1">{steps.map(s => {
      const Icon = s.live ? Loader2 : ICONS[s.kind];
      return <li key={s.id}>
        <button type="button" disabled={!s.detail} onClick={() => setExpanded(e => e === s.id ? null : s.id)} className="flex w-full items-start gap-2 rounded px-2 py-1 text-left hover:bg-muted/50 disabled:cursor-default">
          <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${s.live ? 'animate-spin text-primary' : s.kind === 'error' ? 'text-destructive' : 'text-muted-foreground'}`} />
          <span className="min-w-0 flex-1 break-words">{s.title}</span>
          {s.detail && <ChevronRight className={`mt-0.5 h-3 w-3 shrink-0 text-muted-foreground ${expanded === s.id ? 'rotate-90' : ''}`} />}
        </button>
        {expanded === s.id && s.detail && <pre className="mx-2 mb-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-2 font-mono text-[10px] text-muted-foreground">{s.detail.slice(0, 4000)}</pre>}
      </li>;
    })}</ul>}
  </div>;
}

import { useMemo, useRef, useState } from 'react';
import hljs from 'highlight.js/lib/core';
import ts from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import { Copy, Check, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import '@/components/CodeBlock';
hljs.registerLanguage('typescript', ts); hljs.registerLanguage('json', json);
export function SourceEditor({ path, value, onChange, onSave, dirty }: { path: string; value: string; onChange: (value: string) => void; onSave: () => void; dirty: boolean }) {
  const [copied, setCopied] = useState(false);
  const preview = useRef<HTMLPreElement>(null);
  const language = path.endsWith('.json') ? 'json' : /\.[cm]?[jt]sx?$/.test(path) || path.endsWith('.mts') ? 'typescript' : path.endsWith('.css') ? 'css' : path.endsWith('.html') ? 'html' : 'plaintext';
  const highlighted = useMemo(() => language === 'plaintext' ? value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : hljs.highlight(value, { language }).value, [value, language]);
  return <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3 text-xs text-muted-foreground"><span className="truncate font-mono">{path}</span><span className="ml-auto">{dirty ? 'অসংরক্ষিত' : 'সংরক্ষিত'}</span><Button variant="ghost" size="icon" aria-label="ফাইল কপি" title="ফাইল কপি" onClick={async () => { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? <Check /> : <Copy />}</Button><Button size="sm" disabled={!dirty} onClick={onSave}><Save />সংরক্ষণ</Button></div>
    <div className="source-editor relative min-h-0 flex-1 overflow-hidden bg-background">
      <pre ref={preview} aria-hidden="true" className="pointer-events-none absolute inset-0 m-0 overflow-hidden p-4 font-mono text-xs leading-6 whitespace-pre"><code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted + '\n' }} /></pre>
      <textarea aria-label="Source editor" spellCheck={false} value={value} onChange={e => onChange(e.target.value)} onScroll={e => { if (preview.current) { preview.current.scrollTop = e.currentTarget.scrollTop; preview.current.scrollLeft = e.currentTarget.scrollLeft; } }} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); onSave(); } }} className="source-input absolute inset-0 h-full w-full resize-none border-0 bg-transparent p-4 font-mono text-xs leading-6 whitespace-pre outline-none" wrap="off" />
    </div>
  </div>;
}

import { useMemo, useState } from "react";
import hljs from "highlight.js/lib/core";
import xml from "highlight.js/lib/languages/xml";
import javascript from "highlight.js/lib/languages/javascript";
import css from "highlight.js/lib/languages/css";
import { Check, Copy } from "lucide-react";

hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("css", css);

export function CodeBlock({ code, lang = "html", className = "" }: { code: string; lang?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const html = useMemo(() => {
    const l = hljs.getLanguage(lang) ? lang : "html";
    return hljs.highlight(code, { language: l }).value;
  }, [code, lang]);
  return (
    <div className={`relative flex flex-col overflow-hidden rounded-lg border bg-background/70 ${className}`}>
      <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-mono">{lang}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 transition hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "কপি হয়েছে" : "কপি"}
        </button>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-3 text-xs leading-relaxed"><code className="hljs font-mono" dangerouslySetInnerHTML={{ __html: html }} /></pre>
    </div>
  );
}

/** Renders chat text, turning ``` fences into highlighted code blocks. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(```[a-z]*\n?[\s\S]*?(?:```|$))/gi);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {parts.map((p, i) => {
        const m = p.match(/^```([a-z]*)\n?([\s\S]*?)(```)?$/i);
        if (m) return <CodeBlock key={i} lang={m[1] || "html"} code={m[2]} className="max-h-72" />;
        return p.trim() ? <p key={i} className="whitespace-pre-wrap">{p.trim()}</p> : null;
      })}
    </div>
  );
}

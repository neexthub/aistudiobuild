import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Code2, Eye, Globe, Loader2, RefreshCw, Send, Square } from "lucide-react";
import { Logo, StatusDot } from "@/components/StatusDot";
import { CodeBlock, RichText } from "@/components/CodeBlock";
import { getProject, publishProject, updateProject, type ChatMsg, type Project } from "@/lib/store";
import { extractHtml, MODELS, PLAN_PROMPT, streamChat, SYSTEM_PROMPT } from "@/lib/ai";

export const Route = createFileRoute("/project/$id")({
  head: () => ({
    meta: [
      { title: "অ্যাপ বিল্ডার — NextBuild" },
      { name: "description", content: "AI এর সাথে চ্যাট করে অ্যাপ বানান ও প্রিভিউ দেখুন।" },
      { property: "og:title", content: "অ্যাপ বিল্ডার — NextBuild" },
      { property: "og:description", content: "AI এর সাথে চ্যাট করে অ্যাপ বানান ও প্রিভিউ দেখুন।" },
    ],
  }),
  component: Builder,
});

type Mode = "fast" | "reason" | "dual";
const MODE_LABEL: Record<Mode, string> = { fast: "দ্রুত (Qwen)", reason: "চিন্তাশীল (DeepSeek)", dual: "দুই মডেল: পরিকল্পনা + কোড" };

function Builder() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("fast");
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [streaming, setStreaming] = useState("");
  const [tab, setTab] = useState<"preview" | "code">("preview");
  const [err, setErr] = useState("");
  const [frameKey, setFrameKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const p = getProject(id);
    if (!p) nav({ to: "/dashboard" }); else setProject(p);
    taRef.current?.focus();
  }, [id, nav]);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [project?.messages.length, streaming]);

  if (!project) return null;

  const save = (patch: Partial<Project>) => setProject(updateProject(project.id, patch));

  async function run(model: string, system: string, msgs: ChatMsg[], signal: AbortSignal) {
    let acc = "";
    setStreaming("");
    try {
      return await streamChat({ model, system, messages: msgs, signal, onToken: (t) => { acc += t; setStreaming(acc); } });
    } catch (e) {
      if (signal.aborted && (e as Error)?.name === "AbortError") throw e;
      // fallback: try the other model once
      const alt = model === MODELS.fast ? MODELS.reason : MODELS.fast;
      setStage(`সংযোগে সমস্যা, বিকল্প মডেল (${alt}) দিয়ে চেষ্টা করছি…`);
      acc = "";
      return await streamChat({ model: alt, system, messages: msgs, signal, onToken: (t) => { acc += t; setStreaming(acc); } });
    }
  }

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput(""); setErr(""); setBusy(true);
    const ctrl = new AbortController(); abortRef.current = ctrl;
    const userMsg: ChatMsg = { role: "user", content: text };
    let msgs = [...project.messages, userMsg];
    save({ messages: msgs });
    const ctx = project.html ? `\n\nবর্তমান কোড:\n\`\`\`html\n${project.html.slice(0, 6000)}\n\`\`\`` : "";
    const forModel: ChatMsg[] = [...msgs.slice(0, -1).slice(-6), { role: "user", content: text + ctx }];
    try {
      let plan = "";
      if (mode === "dual") {
        setStage("DeepSeek পরিকল্পনা করছে…");
        plan = await run(MODELS.reason, PLAN_PROMPT, [{ role: "user", content: text }], ctrl.signal);
        msgs = [...msgs, { role: "assistant", content: "📋 পরিকল্পনা:\n" + plan, model: MODELS.reason }];
        save({ messages: msgs });
      }
      const model = mode === "reason" ? MODELS.reason : MODELS.fast;
      setStage(`${model} কোড লিখছে…`);
      const last = forModel[forModel.length - 1];
      const prompt = plan ? [...forModel.slice(0, -1), { ...last, content: last.content + "\n\nএই পরিকল্পনা অনুসরণ করো:\n" + plan }] : forModel;
      const reply = await run(model, SYSTEM_PROMPT, prompt, ctrl.signal);
      const html = extractHtml(reply);
      msgs = [...msgs, { role: "assistant", content: reply || "দুঃখিত, কোনো উত্তর পাইনি।", model }];
      save({ messages: msgs, ...(html ? { html } : {}) });
      if (html) { setTab("preview"); setFrameKey((k) => k + 1); }
    } catch (e) {
      const aborted = ctrl.signal.aborted;
      setErr(aborted ? "বন্ধ করা হয়েছে।" : `AI সার্ভারে সংযোগ হচ্ছে না: ${(e as Error).message}. একটু পরে আবার চেষ্টা করুন।`);
    } finally {
      setBusy(false); setStreaming(""); setStage(""); abortRef.current = null; taRef.current?.focus();
    }
  };

  const publish = () => {
    try { setProject(publishProject(project.id)); }
    catch (e) { setErr((e as Error).message); }
  };
  const pubUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${project.slug}` : `/p/${project.slug}`;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <Link to="/dashboard" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="ফিরে যান"><ArrowLeft className="h-4 w-4" /></Link>
        <Logo />
        <span className="truncate text-sm text-muted-foreground">/ {project.name}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <StatusDot />
          <button onClick={publish} disabled={!project.html}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-40">
            <Globe className="h-4 w-4" /> {project.published ? "আবার পাবলিশ" : "পাবলিশ"}
          </button>
        </div>
      </header>
      {project.published && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-success/10 px-4 py-1.5 text-xs text-success">
          পাবলিশ হয়েছে: <a href={pubUrl} target="_blank" rel="noreferrer" className="font-mono underline">{pubUrl}</a>
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[420px_1fr]">
        {/* chat */}
        <section className="flex min-h-0 flex-col border-r">
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {project.messages.length === 0 && !busy && (
              <div className="glass rounded-xl p-4 text-sm text-muted-foreground">
                👋 আসসালামু আলাইকুম! আমি NextBuild AI। বাংলায় বলুন কী অ্যাপ বানাতে চান — যেমন “একটি টু-ডু লিস্ট অ্যাপ বানাও”।
              </div>
            )}
            {project.messages.map((m, i) => <Bubble key={i} m={m} />)}
            {busy && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-xs text-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" />{stage || "ভাবছি…"}</p>
                {streaming ? <Bubble m={{ role: "assistant", content: streaming }} /> : <div className="flex gap-1 p-2">{[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-pulse rounded-full bg-primary" style={{ animationDelay: `${d * 150}ms` }} />)}</div>}
              </div>
            )}
            {err && <p className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">{err}</p>}
            <div ref={endRef} />
          </div>
          <div className="space-y-2 border-t p-3">
            <select value={mode} onChange={(e) => setMode(e.target.value as Mode)} disabled={busy}
              className="w-full rounded-lg border bg-input/40 px-2 py-1.5 text-xs outline-none">
              {(Object.keys(MODE_LABEL) as Mode[]).map((m) => <option key={m} value={m} className="bg-card">{MODE_LABEL[m]}</option>)}
            </select>
            <div className="flex gap-2">
              <textarea ref={taRef} value={input} onChange={(e) => setInput(e.target.value)} rows={2}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="কী বানাতে চান লিখুন…" className="flex-1 resize-none rounded-lg border bg-input/40 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              {busy ? (
                <button onClick={() => abortRef.current?.abort()} aria-label="থামান" className="h-10 w-10 shrink-0 self-end rounded-lg bg-destructive text-destructive-foreground"><Square className="mx-auto h-4 w-4" /></button>
              ) : (
                <button onClick={send} disabled={!input.trim()} aria-label="পাঠান" className="h-10 w-10 shrink-0 self-end rounded-lg bg-primary text-primary-foreground disabled:opacity-40"><Send className="mx-auto h-4 w-4" /></button>
              )}
            </div>
          </div>
        </section>

        {/* preview / code */}
        <section className="flex min-h-[60vh] flex-col bg-muted/30">
          <div className="flex items-center gap-1 border-b px-3 py-2">
            {([["preview", Eye, "প্রিভিউ"], ["code", Code2, "কোড"]] as const).map(([t, I, l]) => (
              <button key={t} onClick={() => setTab(t)} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition ${tab === t ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <I className="h-4 w-4" /> {l}
              </button>
            ))}
            <button onClick={() => setFrameKey((k) => k + 1)} className="ml-auto rounded p-1.5 text-muted-foreground hover:bg-muted" aria-label="রিফ্রেশ"><RefreshCw className="h-4 w-4" /></button>
          </div>
          <div className="min-h-0 flex-1 p-3">
            {!project.html ? (
              <div className="flex h-full items-center justify-center text-center text-muted-foreground">এখানে আপনার অ্যাপের লাইভ প্রিভিউ দেখা যাবে।</div>
            ) : tab === "preview" ? (
              <iframe key={frameKey} title="preview" srcDoc={project.html} sandbox="allow-scripts allow-forms allow-modals allow-same-origin" className="h-full w-full rounded-lg border bg-card" />
            ) : (
              <CodeBlock code={project.html} className="h-full overflow-auto" />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: ChatMsg }) {
  if (m.role === "user") return <div className="ml-8 rounded-xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground whitespace-pre-wrap">{m.content}</div>;
  return (
    <div className="mr-2 space-y-1">
      {m.model && <span className="font-mono text-[10px] text-muted-foreground">{m.model}</span>}
      <RichText text={m.content} />
    </div>
  );
}

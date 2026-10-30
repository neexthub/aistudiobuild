import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe, LogOut, Pencil, Plus, Trash2 } from "lucide-react";
import { Logo, StatusDot } from "@/components/StatusDot";
import { createProject, deleteProject, listProjects, signOut, updateProject, type Project } from "@/lib/store";
import { useUser } from "@/lib/use-user";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "আমার প্রজেক্ট — NextBuild" },
      { name: "description", content: "আপনার সব অ্যাপ প্রজেক্ট এক জায়গায়।" },
      { property: "og:title", content: "আমার প্রজেক্ট — NextBuild" },
      { property: "og:description", content: "আপনার সব অ্যাপ প্রজেক্ট এক জায়গায়।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const nav = useNavigate();
  const [user] = useUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    if (user === null) nav({ to: "/" });
    if (user) setProjects(listProjects(user.id));
  }, [user, nav]);

  if (!user) return null;
  const refresh = () => setProjects(listProjects(user.id));

  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <StatusDot />
          <span className="hidden text-sm text-muted-foreground sm:inline">স্বাগতম, {user.name}</span>
          <button onClick={() => { signOut(); nav({ to: "/" }); }} className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="লগআউট">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-8 px-5 py-6">
        <form
          onSubmit={(e) => { e.preventDefault(); const p = createProject(user.id, name || "নতুন অ্যাপ"); nav({ to: "/project/$id", params: { id: p.id } }); }}
          className="glass flex flex-col gap-3 rounded-2xl p-5 sm:flex-row"
        >
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="নতুন প্রজেক্টের নাম (যেমন: todo app)"
            className="flex-1 rounded-lg border bg-input/40 px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring" />
          <button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition hover:opacity-90">
            <Plus className="h-4 w-4" /> নতুন প্রজেক্ট
          </button>
        </form>

        <h2 className="font-display text-2xl font-bold">আমার প্রজেক্ট ({projects.length})</h2>
        {projects.length === 0 && <p className="text-muted-foreground">এখনো কোনো প্রজেক্ট নেই। উপরে নাম লিখে শুরু করুন।</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <div key={p.id} className="glass group flex flex-col rounded-xl p-4 transition hover:border-primary/40">
              <Link to="/project/$id" params={{ id: p.id }} className="flex-1 space-y-1">
                <h3 className="font-semibold group-hover:text-primary">{p.name}</h3>
                <p className="text-xs text-muted-foreground">{p.messages.length} বার্তা · {new Date(p.updatedAt).toLocaleString("bn-BD")}</p>
              </Link>
              <div className="mt-4 flex items-center gap-2 text-xs">
                {p.published ? (
                  <Link to="/p/$slug" params={{ slug: p.slug }} target="_blank" className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-success">
                    <Globe className="h-3 w-3" /> /p/{p.slug}
                  </Link>
                ) : <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">খসড়া</span>}
                <div className="ml-auto flex gap-1">
                  <button aria-label="নাম বদলান" onClick={() => { const n = prompt("নতুন নাম", p.name); if (n) { updateProject(p.id, { name: n }); refresh(); } }} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                  <button aria-label="মুছুন" onClick={() => { if (confirm("প্রজেক্টটি মুছে ফেলবেন?")) { deleteProject(p.id); refresh(); } }} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

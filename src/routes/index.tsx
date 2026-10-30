import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, Database, Globe, Zap } from "lucide-react";
import { Logo, StatusDot } from "@/components/StatusDot";
import { currentUser, signIn, signUp } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NextBuild — বাংলায় AI দিয়ে অ্যাপ বানান" },
      { name: "description", content: "চ্যাট করে অ্যাপ বানান, প্রিভিউ দেখুন ও এক ক্লিকে পাবলিশ করুন। বাংলায় কথা বলা AI এজেন্ট।" },
      { property: "og:title", content: "NextBuild — বাংলায় AI অ্যাপ বিল্ডার" },
      { property: "og:description", content: "চ্যাট করে অ্যাপ বানান, প্রিভিউ দেখুন ও পাবলিশ করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { if (currentUser()) nav({ to: "/dashboard" }); }, [nav]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      mode === "signup" ? signUp(name, email, pass) : signIn(email, pass);
      nav({ to: "/dashboard" });
    } catch (x) { setErr((x as Error).message); }
  };

  return (
    <div className="min-h-screen bg-hero">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <StatusDot />
      </header>
      <main className="mx-auto grid max-w-6xl gap-12 px-5 py-10 lg:grid-cols-2 lg:py-20">
        <section className="space-y-6">
          <span className="inline-block rounded-full border border-primary/30 px-3 py-1 text-xs text-primary">Lovable AI + ফ্রি মডেল · অটো ফেইলওভার</span>
          <h1 className="font-display text-4xl font-bold leading-tight md:text-6xl">
            কথা বলুন,<br /><span className="text-primary">অ্যাপ তৈরি</span> হয়ে যাবে।
          </h1>
          <p className="max-w-lg text-lg text-muted-foreground">
            NextBuild-এ বাংলায় বলুন কী চান — AI এজেন্ট পরিকল্পনা করবে, কোড লিখবে, সাথে সাথে প্রিভিউ দেখাবে, আর এক ক্লিকে পাবলিশ।
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              [Bot, "মাল্টি-এজেন্ট বিল্ড"],
              [Zap, "বহু-পাতার লাইভ প্রিভিউ"],
              [Database, "অনলাইন সার্চ ও ছবি"],
              [Globe, "এক ক্লিকে পাবলিশ"],
            ].map(([I, t], i) => {
              const Icon = I as typeof Bot;
              return (
                <div key={i} className="glass flex items-center gap-3 rounded-xl p-3 text-sm">
                  <Icon className="h-4 w-4 text-primary" /> {t as string}
                </div>
              );
            })}
          </div>
        </section>

        <form onSubmit={submit} className="glass space-y-4 self-start rounded-2xl p-6 md:p-8">
          <div className="flex rounded-lg bg-muted p-1 text-sm">
            {(["signup", "login"] as const).map((m) => (
              <button type="button" key={m} onClick={() => setMode(m)}
                className={`flex-1 rounded-md py-2 transition ${mode === m ? "bg-card text-foreground shadow" : "text-muted-foreground"}`}>
                {m === "signup" ? "নতুন অ্যাকাউন্ট" : "লগইন"}
              </button>
            ))}
          </div>
          {mode === "signup" && <Field label="আপনার নাম" value={name} onChange={setName} />}
          <Field label="ইমেইল" type="email" value={email} onChange={setEmail} />
          <Field label="পাসওয়ার্ড" type="password" value={pass} onChange={setPass} />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button className="w-full rounded-lg bg-primary py-2.5 font-semibold text-primary-foreground transition hover:opacity-90 active:scale-[0.99]">
            {mode === "signup" ? "অ্যাকাউন্ট খুলুন" : "প্রবেশ করুন"}
          </button>
          <p className="text-center text-xs text-muted-foreground">সব ডেটা এই ব্রাউজারের ফাইলে সংরক্ষিত থাকে।</p>
        </form>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border bg-input/40 px-3 py-2 outline-none transition focus:ring-2 focus:ring-ring" />
    </label>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPublished } from "@/lib/store";
import { getPublishedApp } from "@/lib/publish.functions";

export const Route = createFileRoute("/p/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — NextBuild এ তৈরি` },
      { name: "description", content: "NextBuild দিয়ে তৈরি ও পাবলিশ করা অ্যাপ।" },
      { property: "og:title", content: `${params.slug} — NextBuild` },
      { property: "og:description", content: "NextBuild দিয়ে তৈরি ও পাবলিশ করা অ্যাপ।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Published,
});

function Published() {
  const { slug } = Route.useParams();
  const [html, setHtml] = useState<string | null | undefined>(undefined);
  useEffect(() => { let live = true; getPublishedApp({ data: { slug } }).then(r => { if (live) setHtml(r?.html ?? getPublished(slug)?.publishedHtml ?? null); }).catch(() => { if (live) setHtml(getPublished(slug)?.publishedHtml ?? null); }); return () => { live = false; }; }, [slug]);

  if (html === undefined) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">লোড হচ্ছে…</div>;
  if (html === null)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-3xl font-bold">অ্যাপটি পাওয়া যায়নি</h1>
        <p className="text-muted-foreground">“{slug}” নামে কোনো পাবলিশ করা অ্যাপ নেই।</p>
        <Link to="/" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">NextBuild এ যান</Link>
      </div>
    );
  // Isolated from NextBuild's own storage; a memory shim keeps apps that use localStorage working.
  const shim = '<script>try{window.localStorage.getItem("x")}catch(e){var m={};var s={getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},clear:function(){m={}},key:function(i){return Object.keys(m)[i]||null},get length(){return Object.keys(m).length}};Object.defineProperty(window,"localStorage",{value:s});Object.defineProperty(window,"sessionStorage",{value:s})}</script>';
  const doc = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + shim) : shim + html;
  return <iframe title={slug} srcDoc={doc} className="h-screen w-full border-0" sandbox="allow-scripts allow-forms allow-modals allow-popups" />;
}

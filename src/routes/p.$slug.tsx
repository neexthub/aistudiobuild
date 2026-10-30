import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getPublished } from "@/lib/store";

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
  useEffect(() => { setHtml(getPublished(slug)?.publishedHtml ?? null); }, [slug]);

  if (html === undefined) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">লোড হচ্ছে…</div>;
  if (html === null)
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-3xl font-bold">অ্যাপটি পাওয়া যায়নি</h1>
        <p className="text-muted-foreground">“{slug}” নামে কোনো পাবলিশ করা অ্যাপ নেই।</p>
        <Link to="/" className="rounded-lg bg-primary px-4 py-2 text-primary-foreground">NextBuild এ যান</Link>
      </div>
    );
  return <iframe title={slug} srcDoc={html} className="h-screen w-full border-0" sandbox="allow-scripts allow-forms allow-modals allow-same-origin" />;
}

import { createFileRoute } from "@tanstack/react-router";

type Hit = { title: string; snippet: string; url: string };
const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();

async function ddg(q: string): Promise<Hit[]> {
  const r = await fetch('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q), { headers: { 'user-agent': 'Mozilla/5.0 NextBuild' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return [];
  const html = await r.text(); const out: Hit[] = [];
  for (const m of html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)) {
    let url = m[1]!; const u = /uddg=([^&]+)/.exec(url); if (u) url = decodeURIComponent(u[1]!);
    out.push({ title: strip(m[2]!), snippet: strip(m[3]!), url });
    if (out.length >= 6) break;
  }
  return out;
}

async function wiki(q: string): Promise<Hit[]> {
  const r = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=4&origin=*&srsearch=${encodeURIComponent(q)}`, { headers: { 'user-agent': 'NextBuild/1.0' }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return [];
  const j = await r.json() as { query?: { search?: { title: string; snippet: string }[] } };
  return (j.query?.search ?? []).map(s => ({ title: s.title, snippet: strip(s.snippet), url: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(s.title.replace(/ /g, '_')) }));
}

export const Route = createFileRoute("/api/ai/search")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({})) as { q?: unknown };
        const q = typeof body.q === 'string' ? body.q.trim().slice(0, 200) : '';
        if (!q) return Response.json({ results: [] }, { status: 400 });
        let results = await ddg(q).catch(() => [] as Hit[]);
        let source = 'duckduckgo';
        if (!results.length) { results = await wiki(q).catch(() => []); source = 'wikipedia'; }
        return Response.json({ source, results });
      },
    },
  },
});

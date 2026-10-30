<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- NextBuild data lives in browser-storage JSON "files" via src/lib/store.ts (users.json, projects.json); no database — user asked for file-based storage without a backend.
- All Ollama VPS calls go through server routes /api/ai/* (src/lib/ollama.server.ts) so the https app avoids mixed-content and the VPS URL stays in one place.
- Generated apps are plain multi-page HTML/CSS/JS only (no Next.js/React) so the in-browser bundler can preview and publish them without a build server; local .html links are routed inside the preview.
- Store source as a versioned file map with legacy HTML migration; validate file operations atomically and use revision hashes for conflict detection, not authentication.
- Agent plans use validated dependency graphs and sequential scoped inference; source output is a candidate, never a compiler/test or deployment success signal.
- Keep unavailable external runner/search/media/public-publish tools visibly blocked until configured; browser-local accounts and source do not authorize public services.
- Agent steps retry via withFallback with an `attempt` index so the server starts on a different model; coders/quality emit <<<FILE>>> blocks, not JSON, because JSON-escaped full files break often.
- Router tries Lovable AI first, then the shared key pool; SSE→NDJSON pull must loop until it enqueues, or the stream stalls.
- Router order: Lovable AI, then pool keys grouped by provider (same provider's other key before next provider); agent steps have per-attempt time budgets so slow models hand over.
- Full-mode agents get free keyless web search (/api/ai/search: DuckDuckGo, Wikipedia fallback) as untrusted webNotes.

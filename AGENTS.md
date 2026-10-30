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

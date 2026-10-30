# NextBuild upgrade

- [x] Review old chat and current remix; identify actual feature gaps.
- [x] Restore missing client dependency and run existing tests.
- [x] Deliver detailed master prompt, safe VPS guide, and phased implementation plan.
- [x] Multi-file studio, scoped agents, build/preview/publish, assistance tools.
- [x] Online search connected (free, no key); external build runner no longer needed (HTML-only apps).
## Multi-provider agent swarm (Oct 30)
- [x] Shared API key pool + settings modal, auto rotation/failover, built-in fallback
- [x] Planner → parallel subagents → quality → test → build → publish
- [x] Real publish link for multi-file apps
- [x] Visible agent terminal: agent file commands (ls/cat/create/edit/rm) shown live; user can run them too

- [x] Fix agent stream abort
- [x] Lovable-style inline work steps in chat (read/edit/run, click for details)
- [x] Auto-switch mid-stream
- [x] Auto-switch model on failure/stall in every agent step
- [x] Uploaded CSV keys set as default shared keys
- [x] Live test settings key status + full mode on phone and desktop
- [x] Settings: show Lovable AI usage/limit status
- [x] Lovable AI first; on limit → auto switch; after all fail → one more full round; then tell user "no balance on any API"
- [x] Files appear live in file manager while AI writes; preview opens after run
## Lovable API + OpenAI (Oct 31)
- [x] Settings: add your own Lovable AI key (with how-to-get steps); runs right after the built-in key
- [x] OpenAI models added: own-key provider + OpenAI models through the built-in Lovable key
- [x] Live browser check: settings dropdown (13 providers), Lovable how-to box, OpenAI how-to, live key status
- [ ] One full multi-file build re-run after the router's new built-in OpenAI candidate
- [x] Inline ghost-text next-words suggestion in chat input (click/Tab to accept)
- [x] AI browser auto-checks desktop + mobile after every build (overflow/errors) and auto-fixes
- [ ] Bengali mic voice typing + AI speaks step/summary in Bengali

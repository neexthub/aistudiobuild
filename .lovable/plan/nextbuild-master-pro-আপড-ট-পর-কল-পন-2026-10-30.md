# NextBuild Master Pro আপডেট পরিকল্পনা

## লক্ষ্য
একটি বাংলা অনুরোধ থেকে পরিকল্পনা, প্রয়োজনমতো উপ-এজেন্ট, মাল্টি-ফাইল কোড, প্রকৃত পরীক্ষা, প্রিভিউ এবং যাচাইকৃত প্রকাশ। চ্যাট, ফাইল, প্রিভিউ, কাজের অগ্রগতি ও সহায়ক টুল একই Lovable-সদৃশ স্টুডিওতে থাকবে।

## বর্তমান রিমিক্সে যা যাচাই হয়েছে
- এখন একটি HTML ফাইল তৈরি হয়; প্রকৃত Next.js ফাইল বা build runner নেই।
- প্রজেক্ট এবং প্রকাশিত HTML এই ব্রাউজারের JSON storage-এ থাকে; অন্য দর্শকের public link নির্ভরযোগ্য নয়। আগের সংস্করণের shared publish ব্যবস্থা এই রিমিক্সে যুক্ত নেই।
- পুরোনো Qwen 7B/DeepSeek মডেল যুক্ত; আপনার নির্বাচিত দুটি ১৪B model যুক্ত করা বাকি।
- অনুপস্থিত প্রয়োজনীয় প্যাকেজ যোগ হয়েছে। বর্তমান পাঁচটি পরীক্ষা পাস, প্রজেক্ট খোলে, নতুন build errors নেই।

## প্রস্তুত বিস্তারিত নির্দেশনা
`docs/nextbuild-master-prompt.md`: সম্পূর্ণ master prompt, agent/task/file-operation contracts, tools, background recovery, security, file structures ও acceptance checks।

`docs/nextbuild-vps-guide.md`: model download/remove, port 11435, conservative concurrency, measurements, private Ollama gateway এবং build/publish prerequisites। ডাউনলোডযোগ্য কপিও তৈরি হয়েছে।

## ধাপ ১ — মাল্টি-ফাইল স্টুডিও
- পুরোনো HTML প্রজেক্ট হারানো ছাড়াই versioned file manifest-এ migration; legacy preview আলাদা রাখা।
- ফাইল ট্রি, ফাইলের ট্যাব, syntax-highlighted source editing, create/rename/delete, save/reload, revision diff ও rollback।
- চ্যাট, agent timeline, build logs, tools activity এবং device-size preview। ছোট পর্দায় panel switch, বড় পর্দায় পাশাপাশি; page নয়, সংশ্লিষ্ট অংশ ভিতরে scroll করবে।
- সম্পূর্ণ generated Next.js App Router template, config, lockfile, components, assets ও tests। ZIP export-এ secrets/dependencies/build output থাকবে না।

## ধাপ ২ — পরিকল্পনাভিত্তিক master/subagent
- Master/coder `qwen2.5-coder:14b`; planner/typing assistant `qwen2.5:14b`। Installed tags যাচাই; অনুপস্থিত model নীরবে বদলানো নয়।
- Master planner-কে কাজ দেবে, task graph যাচাই করে প্রয়োজনীয় scoped subagent তৈরি করবে। একই model-এর একাধিক task পৃথক context পাবে।
- Dependency, assigned files ও base hash যাচাই; overlapping patches integrator সমাধান করবে। Arbitrary token chunks নয়, সম্পূর্ণ module/task output।
- শুরুতে এক active inference; অন্য agent queue-তে। স্বাধীন tool কাজ parallel হতে পারে; VPS measurement ছাড়া unlimited parallel model নয়।
- বাস্তব streaming status, cancellation, safe errors এবং bounded repair। Default `num_ctx=4096`; selective context ও summaries।

## ধাপ ৩ — VPS durable service ও প্রকৃত build
- File-based project CRUD বজায় রেখে VPS-এ persistent project/revision/job files, atomic writes, locks, ownership, quotas ও backups। Browser storage শুধু legacy/offline compatibility।
- বর্তমান browser-local login নিরাপদ server identity নয়; public runner খুলবার আগে secure file-backed accounts/session অথবা অনুমোদিত trusted session bridge।
- স্থায়ী worker queue, task checkpoints, reconnect events, stop propagation এবং safe restart recovery। শুধু browser timer দিয়ে background কাজ নয়।
- Hardened isolated runner-এ approved pinned Next.js template install/test/build; real exit status এবং logs। এক build worker দিয়ে শুরু।
- Shared VPS-এর model/build memory বাজেট আলাদা; arbitrary shell/Dockerfile public input নয়। Public hostile-code execution-এর আগে stronger sandboxing প্রয়োজন।

## ধাপ ৪ — প্রকৃত preview/publish
- Generated code studio থেকে আলাদা origin-এ preview; studio cookies/secrets কখনো দেওয়া নয়।
- প্রথমে Next.js static export। Server actions/SSR/backend-required app-এর জন্য পৃথক runtime দরকার; unavailable হলে স্পষ্ট অবস্থা।
- Immutable artifact, build ID/checksum, atomic publish pointer, slug collision handling ও rollback।
- `/p/slug` share gateway থেকে isolated artifact দেখানো; সরাসরি subpath static hosting হলে exact `basePath` build-time-এ বসিয়ে nested routes/chunks/media যাচাই।
- নতুন browser-এ URL খুলে, reload এবং republish-এর পর যাচাই; localStorage-নির্ভর প্রকাশ নয়।

## ধাপ ৫ — সব জায়গায় সহায়ক agent ও tools
- Opt-in Bangla typing suggestions: debounce, stale cancellation, accept/dismiss, low-priority queue; user text নিজে বদলাবে না।
- নির্বাচিত ফাইল, preview element, build error এবং publish failure থেকে contextual assistance।
- Typed tool registry: project exploration, safe URL reader, online search, validated downloads, screenshots, export এবং deployment verification।
- URL reader-এ DNS/redirect/private-address protection, size/type limits; page instructions untrusted। Search-এ বাস্তব sources/citations।
- Image/video generation আলাদা configured media service দিয়ে; দুটি Ollama text model ছবি/video বানায় না। Video job tracking/cancel, cost consent, provenance এবং stored assets।
- Configured/unavailable/permission-required অবস্থা সঠিক দেখানো; fake tool success নয়। Provider/service access না থাকলে adapter/UI প্রস্তুত হবে, live কাজ blocked থাকবে।

## VPS নির্দেশনার গুরুত্বপূর্ণ সংশোধন
৩২ GB RAM থেকে GPU/CPU speed বা ChatGPT-সমান ফল নিশ্চিত হয় না। প্রথমে parallel=1 এবং loaded model=1; measurement অনুযায়ী বৃদ্ধি। দুটো model disk-এ থাকবে। নতুনগুলো download/test হওয়ার আগে পুরোনো মুছবেন না।

Ollama loopback binding করতে হবে authenticated HTTPS gateway চালু এবং NextBuild connection বদলানোর সময়; আগে করলে বর্তমান public-IP connection বিচ্ছিন্ন হবে। VPS setup এখানে execute করা হয়নি।

## প্রযুক্তিগত সীমা
- **Studio:** বর্তমান TanStack Start/React ভিত্তি বজায় থাকবে; hosted project-কে Next.js-এ রূপান্তর নয়।
- **Generated apps:** Next.js App Router, TypeScript, semantic Tailwind tokens, pinned reproducible template।
- **Execution:** VPS worker/sandbox; hosted server runtime থেকে Docker/Node subprocess চালানো নয়।
- **Data:** file-based project storage; private account/session data exports ও public artifacts থেকে বাদ। Shared cloud project tables নতুন করে যোগ করা নয়।
- **Security:** trusted ownership verification, server-side credentials, scoped tool permissions ও separate origins।

## পরীক্ষা ও গ্রহণযোগ্যতা
- Legacy migration/reload, file CRUD/revision conflict, invalid paths এবং plan dependency cycles।
- Model selection, distinct subagent context, concurrency limit, streaming fragments, Stop/reconnect/restart।
- আসল template install/test/build; failed candidate live revision বদলাবে না।
- Requested generated-app workflow বাস্তব preview input/readback দিয়ে যাচাই।
- Clean-browser public URL, nested routes/assets, publish update ও rollback।
- Typing stale response/rate limits; URL SSRF/injection; download archive traversal; media failure/cancellation।
- 360/390/768/1366/1920px layout, internal scrolling এবং console errors।

## বাস্তবায়ন এবং বাহ্যিক নির্ভরতা
পরিকল্পনা অনুমোদনের পর ধাপ ১ ও ২-এর ভিত্তি দিয়ে বাস্তবায়ন শুরু হবে, এরপর প্রস্তুত service অনুযায়ী বাকি ধাপ। Studio, schemas, tests এবং service adapters এখানে তৈরি করা যায়। Live VPS deployment, model availability, authenticated gateway, isolated preview/public DNS/TLS এবং search/media access ছাড়া প্রকৃত background runner ও publish end-to-end verified বলা যাবে না। অনুপস্থিত service-এর কাজ স্পষ্ট blocked থাকবে; সম্পূর্ণ হয়েছে বলা হবে না।
# NextBuild VPS সেটআপ — ৩২ GB RAM-এর জন্য নিরাপদ শুরু

আপনার VPS-এ 31Gi RAM দেখা গেছে; CPU/GPU পরীক্ষা হয়নি। আগের “১৪B মডেল ChatGPT-সমান” এবং “সব agent parallel দ্রুত চলবে” দাবিগুলো নিশ্চিত নয়। দুটো নির্বাচিত model রাখা যায়, কিন্তু CPU-only inference ধীর হতে পারে।

## ১. প্রথমে তথ্য ও backup

SSH-তে রান করুন; output-এ private service secrets থাকলে chat-এ পাঠাবেন না।

```bash
free -h
lscpu
command -v nvidia-smi >/dev/null && nvidia-smi
systemctl is-active ollama
ss -ltnp | grep -E ':11434|:11435'
export OLLAMA_HOST=127.0.0.1:11435
ollama list
ollama ps
```

Model/service পরিবর্তনের আগে existing systemd drop-ins এবং project data backup নিন। বর্তমান SSH port/পদ্ধতি না যাচাই করে firewall reset করবেন না।

## ২. নতুন মডেল আগে নামান, তারপর পুরোনো মুছুন

```bash
export OLLAMA_HOST=127.0.0.1:11435
ollama pull qwen2.5:14b
ollama pull qwen2.5-coder:14b
ollama list
```

Download সফল না হলে পুরোনো model আগে মুছবেন না। দুটো পরীক্ষা করুন:

```bash
ollama run qwen2.5:14b 'বাংলায় তিন ধাপে একটি inventory app-এর পরিকল্পনা দাও।'
ollama run qwen2.5-coder:14b 'Write a TypeScript function that adds two numbers with a small test.'
ollama ps
```

নতুন দুটি ঠিক কাজ করলে কেবল `ollama list`-এ থাকা অনাকাঙ্ক্ষিত model মুছুন:

```bash
ollama rm qwen2.5-coder:1.5b
ollama rm deepseek-coder:6.7b
ollama rm deepseek-coder-v2:latest
# শুধু দুটি model রাখতে চাইলে এবং নতুন coder পরীক্ষা পাস করলে:
ollama rm qwen2.5-coder:7b
```

“model not found” হলে নাম অনুমান করে deletion পুনরাবৃত্তি দরকার নেই।

## ৩. Conservative performance configuration

এটি নতুন drop-in লিখবে; পুরোনো drop-in মুছবে না। অন্য file একই variable override করলে local-এ effective configuration পরীক্ষা করুন।

```bash
sudo mkdir -p /etc/systemd/system/ollama.service.d
sudo tee /etc/systemd/system/ollama.service.d/zz-nextbuild.conf >/dev/null <<'CONF'
[Service]
Environment="OLLAMA_HOST=127.0.0.1:11435"
Environment="OLLAMA_NUM_PARALLEL=1"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
Environment="OLLAMA_MAX_QUEUE=16"
Environment="OLLAMA_CONTEXT_LENGTH=4096"
Environment="OLLAMA_KEEP_ALIVE=5m"
CONF
sudo systemctl daemon-reload
sudo systemctl restart ollama
export OLLAMA_HOST=127.0.0.1:11435
curl --fail --silent --show-error http://127.0.0.1:11435/api/tags
```

**সতর্কতা:** `127.0.0.1` binding দিলে NextBuild-এর বর্তমান public-IP proxy সরাসরি পৌঁছাতে পারবে না। তাই এটি public app-এর একমাত্র connection হলে এখনই binding বদলাবেন না; আগে authenticated HTTPS VPS gateway/private connection deploy ও NextBuild proxy update করে cutover করুন। Ollama নিজে public API authentication দেয় না; raw `11435` internet-এ খোলা রাখা নিরাপদ নয়। CORS নিরাপত্তার বিকল্প নয়।

দুটি model disk-এ থাকবে, শুরুতে একবারে একটি memory-তে থাকবে। এতে swap/loading delay হতে পারে; পর্যাপ্ত headroom থাকলে benchmark করে `MAX_LOADED_MODELS=2` বিবেচনা করা যাবে। বড় queue মানেই বেশি throughput নয়। অন্ধভাবে parallel=4, loaded=3 বা keep_alive=24h ব্যবহার করবেন না।

## ৪. পরিমাপ করে tuning

একই representative prompt-এ planning, coding ও full run মাপুন। record করুন first-token latency, total duration, tokens/sec, peak RAM এবং runner চলার সময় CPU/memory।

```bash
curl --fail --silent --show-error http://127.0.0.1:11435/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen2.5-coder:14b","prompt":"Write a small TypeScript inventory data model.","stream":true,"options":{"num_ctx":4096}}'
```

পরবর্তী load test-এ দুই concurrent request-এর total throughput, tail latency এবং memory দেখুন। improvement ও headroom প্রমাণিত না হলে concurrency=1 রাখুন। আলাদা logical subagent থাকা তবুও সম্ভব; তারা queue দিয়ে ধারাবাহিক inference পাবে। কোনো নির্দিষ্ট tokens/sec গ্যারান্টি দেওয়া হচ্ছে না।

## ৫. প্রকৃত build/publish চালুর prerequisites

Ollama install করলেই Next.js builder/publisher তৈরি হয় না। আলাদা service deploy প্রয়োজন:
- Authenticated HTTPS control API; raw Ollama private থাকে।
- Durable file-backed account/project/job directories, locks, atomic writes, backups।
- Bounded worker queue; browser বন্ধ হলেও approved background job চলবে।
- Hardened isolated Next.js runner; একবারে একটি build দিয়ে শুরু, resource budget test করে নির্ধারণ।
- আলাদা preview/publish origin, DNS এবং TLS। Studio cookies generated app-কে দেওয়া যাবে না।
- Static artifact server এবং `/p/slug` gateway; exact build-time basePath বা isolated subdomain।
- SSR চাইলে পৃথক Node deployment ব্যবস্থা; static export-এ server-only features চলবে না।
- Search এবং image/video service access; text models এসব media তৈরি করে না।

Docker install alone public hostile-code runner নয়। Public arbitrary code launch-এর আগে stronger sandboxing এবং security review প্রয়োজন। Trusted prototype template এবং reviewed dependencies দিয়ে শুরু করুন।

## ৬. এখনকার অবস্থা

এই নির্দেশনা আপনার VPS-এ execute করা হয়নি; SSH access দেওয়া হয়নি এবং model installation এখনো সরাসরি যাচাই হয়নি। Live service configuration, private connection, DNS এবং media/search access ছাড়া end-to-end runner/publish কাজ verified বলা যাবে না। কোনো secret chat-এ paste করবেন না; নিরাপদ secret setup ব্যবহার করতে হবে।

## Official references

- Ollama FAQ / concurrency / memory: https://docs.ollama.com/faq
- Ollama context length: https://docs.ollama.com/context-length
- Ollama authentication: https://docs.ollama.com/api/authentication
- Ollama GPU support: https://docs.ollama.com/gpu
- Next.js static exports: https://nextjs.org/docs/app/guides/static-exports
- Next.js basePath: https://nextjs.org/docs/app/api-reference/config/next-config-js/basePath
- Next.js deployment: https://nextjs.org/docs/app/getting-started/deploying
- Docker rootless: https://docs.docker.com/engine/security/rootless/
- Docker security: https://docs.docker.com/engine/security/
- Docker resource limits: https://docs.docker.com/engine/containers/resource_constraints/

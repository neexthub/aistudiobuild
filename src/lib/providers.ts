// Client-safe registry of free / free-tier AI providers. All are called with the
// OpenAI-compatible /chat/completions API from the server router.
export type AgentRole = 'planner' | 'coder' | 'quality' | 'fast';
export type Provider = { id: string; name: string; baseUrl: string; keyUrl: string; keyHow: string; note: string; models: Record<AgentRole, string> };

/** Models the Lovable AI gateway is called with (no key needed — the project's own key). */
export const BUILTIN_MODELS: Record<AgentRole, string> = { planner: 'google/gemini-3.8-flash', coder: 'google/gemini-3.8-flash', quality: 'google/gemini-3.8-flash', fast: 'google/gemini-3.1-flash-lite' };
/** OpenAI models the same built-in Lovable key can call — no OpenAI account or card needed. */
export const BUILTIN_OPENAI_MODELS: Record<AgentRole, string> = { planner: 'openai/gpt-5.5', coder: 'openai/gpt-5.5', quality: 'openai/gpt-5.5', fast: 'openai/gpt-5.4-mini' };

/**
 * Lovable AI: the project's own key already works with no setup. A user may also
 * paste their own Lovable workspace API key here; it is tried right after the
 * built-in one and is billed to their own workspace.
 */
export const LOVABLE_PROVIDER: Provider = {
  id: 'lovable', name: 'Lovable AI', baseUrl: 'https://ai.gateway.lovable.dev/v1',
  keyUrl: 'https://docs.lovable.dev/features/api-keys',
  keyHow: 'লভাবল ওয়ার্কস্পেস সেটিংস → API keys & OAuth → Workspace access tokens → New API key। মানটা শুধু বার করার ঠিক পরে একবার দেখায় — তখনই কপি করুন। (Business/Enterprise প্ল্যানে ওয়ার্কস্পেস টোকেন; নয়ল্লে প্রজেক্টর নিজস্ব key নিজেই কাজ করে, এখানে কিছুই দিয়ত lagবে না।)',
  note: 'নিজের workspace key (ঐচ্ছিক)', models: BUILTIN_MODELS,
};

export const PROVIDERS: Provider[] = [
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', keyHow: 'platform.openai.com/api-keys — Create new secret key (কার্ড/ব্যালেন্স লাগে)।', note: 'GPT-5.5, প্ৰিয়ম', models: { planner: 'gpt-5.5', coder: 'gpt-5.5', quality: 'gpt-5.4-mini', fast: 'gpt-5.4-nano' } },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', keyHow: 'console.groq.com/keys — সাইন ইন করে Create API key চাপুন।', note: 'সবচেয়ে দ্রুত, ফ্রি', models: { planner: 'openai/gpt-oss-120b', coder: 'openai/gpt-oss-120b', quality: 'qwen/qwen3.8-27b', fast: 'openai/gpt-oss-20b' } },
  { id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey', keyHow: 'aistudio.google.com/apikey — Create API key চাপুন।', note: 'বড় context, ফ্রি', models: { planner: 'gemini-3.5-flash', coder: 'gemini-3.5-flash', quality: 'gemini-3.5-flash', fast: 'gemini-3.1-flash-lite' } },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', keyHow: 'openrouter.ai/keys — Create Key চাপুন; :free মডেল ব্যবহার করুন।', note: ':free মডেল', models: { planner: 'nvidia/nemotron-3-ultra-550b-a55b:free', coder: 'poolside/laguna-s-2.1:free', quality: 'nvidia/nemotron-3-ultra-550b-a55b:free', fast: 'cohere/north-mini-code:free' } },
  { id: 'cerebras', name: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1', keyUrl: 'https://cloud.cerebras.ai', keyHow: 'cloud.cerebras.ai — অ্যাকাউন্ট খুলে API Keys থেকে key নিন।', note: 'অত দ্রুত, ফ্রি', models: { planner: 'llama-3.3-70b', coder: 'qwen-3-32b', quality: 'llama-3.3-70b', fast: 'llama3.1-8b' } },
  { id: 'mistral', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys', keyHow: 'console.mistral.ai/api-keys — Create new key চাপুন।', note: 'Codestral, ফ্রি টিয়াৰ', models: { planner: 'mistral-large-latest', coder: 'codestral-latest', quality: 'mistral-large-latest', fast: 'mistral-small-latest' } },
  { id: 'sambanova', name: 'SambaNova', baseUrl: 'https://api.sambanova.ai/v1', keyUrl: 'https://cloud.sambanova.ai/apis', keyHow: 'cloud.sambanova.ai/apis — Add API key চাপুন।', note: 'ফ্রি', models: { planner: 'DeepSeek-V3.2', coder: 'DeepSeek-V3.2', quality: 'Meta-Llama-3.3-70B-Instruct', fast: 'MiniMax-M3.1-Flash' } },
  { id: 'github', name: 'GitHub Models', baseUrl: 'https://models.github.ai/inference', keyUrl: 'https://github.com/settings/tokens', keyHow: 'github.com/settings/tokens — Fine-grained token বানান, Models-এ read দিন।', note: 'GPT-4.1, ফ্রি', models: { planner: 'openai/gpt-4.1', coder: 'openai/gpt-4.1', quality: 'openai/gpt-4.1-mini', fast: 'openai/gpt-4.1-mini' } },
  { id: 'nvidia', name: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com/v1', keyUrl: 'https://build.nvidia.com', keyHow: 'build.nvidia.com — সাইন ইন করে Get API Key চাপুন।', note: 'ফ্রি ক্রেডিট', models: { planner: 'meta/llama-3.3-70b-instruct', coder: 'qwen/qwen2.5-coder-32b-instruct', quality: 'meta/llama-3.3-70b-instruct', fast: 'meta/llama-3.1-8b-instruct' } },
  { id: 'huggingface', name: 'Hugging Face', baseUrl: 'https://router.huggingface.co/v1', keyUrl: 'https://huggingface.co/settings/tokens', keyHow: 'huggingface.co/settings/tokens — New token → Fine-grained → Inference read।', note: 'ফ্রি টিয়াৰ', models: { planner: 'meta-llama/Llama-3.3-70B-Instruct', coder: 'Qwen/Qwen2.5-Coder-32B-Instruct', quality: 'meta-llama/Llama-3.3-70B-Instruct', fast: 'meta-llama/Llama-3.1-8B-Instruct' } },
  { id: 'together', name: 'Together AI', baseUrl: 'https://api.together.xyz/v1', keyUrl: 'https://api.together.ai/settings/api-keys', keyHow: 'api.together.ai/settings/api-keys — Add API key চাপুন।', note: 'Free মডেল', models: { planner: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free', coder: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free', quality: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free', fast: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free' } },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys', keyHow: 'platform.deepseek.com/api_keys — Create API key চাপুন (পैसे লাগে)।', note: 'খুব সস্তা', models: { planner: 'deepseek-chat', coder: 'deepseek-chat', quality: 'deepseek-chat', fast: 'deepseek-chat' } },
];
export const ALL_PROVIDERS: Provider[] = [LOVABLE_PROVIDER, ...PROVIDERS];
export const BUILTIN_NAME = 'Lovable AI (বিল্ট-ইন, key লাগবের না)';
/** Free image generation without a key; agents use it as <img src>. */
export const imageUrl = (prompt: string, w = 1024, h = 640) => `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true`;

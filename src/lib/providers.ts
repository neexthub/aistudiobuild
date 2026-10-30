// Client-safe registry of free / free-tier AI providers. All are called with the
// OpenAI-compatible /chat/completions API from the server router.
export type AgentRole = 'planner' | 'coder' | 'quality' | 'fast';
export type Provider = { id: string; name: string; baseUrl: string; keyUrl: string; note: string; models: Record<AgentRole, string> };

export const PROVIDERS: Provider[] = [
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', note: 'সবচেয়ে দ্রুত, ফ্রি', models: { planner: 'openai/gpt-oss-120b', coder: 'openai/gpt-oss-120b', quality: 'qwen/qwen3.8-27b', fast: 'openai/gpt-oss-20b' } },
  { id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', keyUrl: 'https://aistudio.google.com/apikey', note: 'বড় context, ফ্রি', models: { planner: 'gemini-3.5-flash', coder: 'gemini-3.5-flash', quality: 'gemini-3.5-flash', fast: 'gemini-3.1-flash-lite' } },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', note: ':free মডেল', models: { planner: 'nvidia/nemotron-3-ultra-550b-a55b:free', coder: 'poolside/laguna-s-2.1:free', quality: 'nvidia/nemotron-3-ultra-550b-a55b:free', fast: 'cohere/north-mini-code:free' } },
  { id: 'cerebras', name: 'Cerebras', baseUrl: 'https://api.cerebras.ai/v1', keyUrl: 'https://cloud.cerebras.ai', note: 'অতি দ্রুত, ফ্রি', models: { planner: 'llama-3.3-70b', coder: 'qwen-3-32b', quality: 'llama-3.3-70b', fast: 'llama3.1-8b' } },
  { id: 'mistral', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys', note: 'Codestral, ফ্রি টিয়ার', models: { planner: 'mistral-large-latest', coder: 'codestral-latest', quality: 'mistral-large-latest', fast: 'mistral-small-latest' } },
  { id: 'sambanova', name: 'SambaNova', baseUrl: 'https://api.sambanova.ai/v1', keyUrl: 'https://cloud.sambanova.ai/apis', note: 'ফ্রি', models: { planner: 'DeepSeek-V3.2', coder: 'DeepSeek-V3.2', quality: 'Meta-Llama-3.3-70B-Instruct', fast: 'MiniMax-M3.1-Flash' } },
  { id: 'github', name: 'GitHub Models', baseUrl: 'https://models.github.ai/inference', keyUrl: 'https://github.com/settings/tokens', note: 'GPT-4.1, ফ্রি', models: { planner: 'openai/gpt-4.1', coder: 'openai/gpt-4.1', quality: 'openai/gpt-4.1-mini', fast: 'openai/gpt-4.1-mini' } },
  { id: 'nvidia', name: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com/v1', keyUrl: 'https://build.nvidia.com', note: 'ফ্রি ক্রেডিট', models: { planner: 'meta/llama-3.3-70b-instruct', coder: 'qwen/qwen2.5-coder-32b-instruct', quality: 'meta/llama-3.3-70b-instruct', fast: 'meta/llama-3.1-8b-instruct' } },
  { id: 'huggingface', name: 'Hugging Face', baseUrl: 'https://router.huggingface.co/v1', keyUrl: 'https://huggingface.co/settings/tokens', note: 'ফ্রি টিয়ার', models: { planner: 'meta-llama/Llama-3.3-70B-Instruct', coder: 'Qwen/Qwen2.5-Coder-32B-Instruct', quality: 'meta-llama/Llama-3.3-70B-Instruct', fast: 'meta-llama/Llama-3.1-8B-Instruct' } },
  { id: 'together', name: 'Together AI', baseUrl: 'https://api.together.xyz/v1', keyUrl: 'https://api.together.ai/settings/api-keys', note: 'Free মডেল', models: { planner: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free', coder: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free', quality: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free', fast: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free' } },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys', note: 'খুব সস্তা', models: { planner: 'deepseek-chat', coder: 'deepseek-chat', quality: 'deepseek-chat', fast: 'deepseek-chat' } },
];
export const BUILTIN_NAME = 'Lovable AI (বিল্ট-ইন, key লাগবে না)';
/** Free image generation without a key; agents use it as <img src>. */
export const imageUrl = (prompt: string, w = 1024, h = 640) => `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${w}&height=${h}&nologo=true`;

import { describe, it, expect } from 'vitest';
import { orderCandidates, BUILTIN_MODELS } from '@/lib/ai-router.server';
import { ALL_PROVIDERS, LOVABLE_PROVIDER, PROVIDERS, BUILTIN_OPENAI_MODELS } from '@/lib/providers';

describe('lovable api key system', () => {
  it('Lovable AI is selectable in settings and points at the Lovable gateway', () => {
    expect(ALL_PROVIDERS[0]!.id).toBe('lovable');
    expect(LOVABLE_PROVIDER.baseUrl).toBe('https://ai.gateway.lovable.dev/v1');
    expect(ALL_PROVIDERS.every(p => p.keyUrl.startsWith('https://') && p.keyHow.length > 10 && !!p.models.fast)).toBe(true);
    expect(PROVIDERS.some(p => p.id === 'lovable')).toBe(false);
  });
  it('a pasted Lovable key runs right after the built-in one, before other providers', () => {
    const list = [{ label: 'Lovable AI · x', builtin: true }, { label: 'Groq · a', keyId: '1' }, { label: 'Lovable AI · x', keyId: '2' }];
    expect(orderCandidates(list).map(c => c.keyId ?? 'builtin')).toEqual(['builtin', '2', '1']);
  });
  it('the router and the settings use the same built-in model list', () => {
    expect(BUILTIN_MODELS).toBe(LOVABLE_PROVIDER.models);
    expect(BUILTIN_MODELS.fast).toBe('google/gemini-3.1-flash-lite');
  });
  it('OpenAI is selectable with its own key, and OpenAI models also run on the built-in key', () => {
    expect(PROVIDERS.some(p => p.id === 'openai' && p.baseUrl === 'https://api.openai.com/v1')).toBe(true);
    expect(BUILTIN_OPENAI_MODELS.planner.startsWith('openai/')).toBe(true);
  });
  it('both built-in models run before any pasted key', () => {
    const list = [{ label: 'Lovable AI · gemini', builtin: true }, { label: 'Lovable AI · gpt', builtin: true }, { label: 'OpenAI · gpt', keyId: '9' }, { label: 'Groq · a', keyId: '1' }];
    expect(orderCandidates(list).map(c => c.keyId ?? 'builtin')).toEqual(['builtin', 'builtin', '9', '1']);
  });
});

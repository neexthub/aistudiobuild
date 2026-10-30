import { describe, it, expect } from 'vitest';
import { orderCandidates, BUILTIN_MODELS } from '@/lib/ai-router.server';
import { ALL_PROVIDERS, LOVABLE_PROVIDER, PROVIDERS } from '@/lib/providers';

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
});

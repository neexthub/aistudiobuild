import { describe, it, expect } from 'vitest';
import { cooldownSecs, rateInfo } from '@/lib/ai-router.server';
import { keyState } from '@/components/studio/ProviderSettings';

describe('key status rules', () => {
  it('wrong key / no access pauses 24h', () => { expect(cooldownSecs(401)).toBe(86400); expect(cooldownSecs(403)).toBe(86400); });
  it('no credit pauses 6h', () => { expect(cooldownSecs(402)).toBe(21600); });
  it('rate limit honours Retry-After, else 90s', () => { expect(cooldownSecs(429, '12')).toBe(12); expect(cooldownSecs(429)).toBe(90); });
  it('reads remaining requests from headers', () => { const r = rateInfo(new Headers({ 'x-ratelimit-limit-requests': '1000', 'x-ratelimit-remaining-requests': '998', 'x-ratelimit-remaining-tokens': '5000' })); expect(r.rate_limit).toBe(1000); expect(r.rate_remaining).toBe(998); expect(r.token_remaining).toBe(5000); });
  it('labels usable vs paused keys', () => { expect(keyState({ cooling: false, status: 200 }).label).toContain('ব্যবহারযোগ্য'); expect(keyState({ cooling: true, status: 402 }).label).toContain('ক্রেডিট'); });
});

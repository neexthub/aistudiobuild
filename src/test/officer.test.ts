import { describe, it, expect, beforeEach } from 'vitest';
import { officerRank, officerRecord, officerReset } from '@/lib/ai-router.server';
import { PROVIDERS } from '@/lib/providers';

const id = (c: { label: string; keyId?: string }) => `${c.label}|${c.keyId ?? ''}`;
describe('officer', () => {
  beforeEach(() => officerReset());
  it('benches a model that just failed behind the others', () => {
    const list = [{ label: 'A' }, { label: 'B' }, { label: 'C' }];
    officerRecord(id(list[0]!), false, 0);
    expect(officerRank(list).map(c => c.label)).toEqual(['B', 'C', 'A']);
  });
  it('puts a proven fast model before an unknown one', () => {
    const list = [{ label: 'A' }, { label: 'B' }];
    officerRecord(id(list[1]!), true, 300);
    expect(officerRank(list).map(c => c.label)).toEqual(['B', 'A']);
  });
  it('a benched model returns after its pause', () => {
    const list = [{ label: 'A' }, { label: 'B' }];
    officerRecord(id(list[0]!), false, 0, 0);
    expect(officerRank(list, 10 * 60 * 1000).map(c => c.label)).toEqual(['A', 'B']);
  });
  it('new providers are listed', () => {
    for (const p of ['siliconflow', 'freeai', 'toptools', 'anymodel']) expect(PROVIDERS.some(x => x.id === p)).toBe(true);
  });
});

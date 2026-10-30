import { describe, expect, it } from 'vitest';
import { withFallback } from '@/lib/ai';
import { parseFileBlocks } from '@/lib/agents/contracts';

describe('auto model switch', () => {
  it('retries on the next model when an answer fails', async () => {
    const seen: number[] = [];
    const r = await withFallback(async a => { seen.push(a); if (a < 2) throw new Error('bad'); return 'ok'; });
    expect(r).toBe('ok'); expect(seen).toEqual([0, 1, 2]);
  });
  it('stops retrying when the user pressed stop', async () => {
    const c = new AbortController(); c.abort(); let n = 0;
    await expect(withFallback(async () => { n++; throw new Error('x'); }, c.signal)).rejects.toThrow(); expect(n).toBe(1);
  });
  it('reads files from agent file blocks', () => {
    const r = parseFileBlocks('<<<FILE index.html>>>\n<h1>"hi"\\n</h1>\n<<<END>>>\nSUMMARY: ঠিক');
    expect(r.files).toEqual([{ path: 'index.html', content: '<h1>"hi"\\n</h1>' }]); expect(r.summaryBn).toBe('ঠিক');
  });
});

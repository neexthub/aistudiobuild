import { describe, it, expect, vi, afterEach } from 'vitest';
import { streamChat } from '@/lib/ai';

const body = (lines: string[], fail = false) => new ReadableStream({ start(c) { for (const l of lines) c.enqueue(new TextEncoder().encode(l + '\n')); if (fail) c.error(new Error('stream broke')); else c.close(); } });
afterEach(() => vi.unstubAllGlobals());

describe('model resume', () => {
  it('next model continues from partial text when a model stops mid-answer', async () => {
    const calls: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: any) => { const b = JSON.parse(init.body); calls.push(b);
      return calls.length === 1 ? new Response(body(['{"message":{"content":"Hello "}}'], true)) : new Response(body(['{"message":{"content":"world"}}'])); }));
    const out = await streamChat({ role: 'fast', system: 's', messages: [{ role: 'user', content: 'hi' }], onToken: () => {} });
    expect(out).toBe('Hello world');
    expect(calls[1].attempt).toBe(1);
    expect(calls[1].messages.at(-2)).toEqual({ role: 'assistant', content: 'Hello ' });
  });
  it('does not retry when credits are exhausted', async () => {
    const f = vi.fn(async () => new Response('402 credits', { status: 402 })); vi.stubGlobal('fetch', f);
    await expect(streamChat({ role: 'fast', system: 's', messages: [{ role: 'user', content: 'hi' }], onToken: () => {} })).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect } from 'vitest';
import { runScript } from '@/lib/project/shell';
describe('virtual shell', () => {
  it('creates, replaces, moves and deletes files', () => {
    const { files, log } = runScript({}, "write index.html <<EOF\n<h1>hi</h1>\nEOF\nreplace index.html <<EOF\nhi\n---\nহ্যালো\nEOF\ntouch a.js\nmv a.js b.js\nrm b.js\nbuild");
    expect(log.some(l => l.error)).toBe(false);
    expect(files['index.html']).toContain('হ্যালো');
    expect(Object.keys(files)).toEqual(['index.html']);
  });
  it('stops at first error and keeps earlier changes', () => {
    const { files, log } = runScript({}, 'touch x.js\nrm nope.js\ntouch y.js');
    expect(log.at(-1)?.error).toBe(true);
    expect(Object.keys(files)).toEqual(['x.js']);
  });
});

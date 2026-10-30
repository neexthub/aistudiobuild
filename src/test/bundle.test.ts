import { describe, expect, it } from 'vitest';
import { bundleHtml, testFiles } from '@/lib/project/bundle';
describe('build and test agents', () => {
  const files = { 'index.html': '<html><head><link rel="stylesheet" href="css/style.css"></head><body><script src="js/app.js"></script></body></html>', 'css/style.css': 'body{color:red}', 'js/app.js': 'let a = 1;' };
  it('inlines css and js into one document', () => { const h = bundleHtml(files)!; expect(h).toContain('body{color:red}'); expect(h).toContain('let a = 1;'); expect(h).not.toContain('src="js/app.js"'); });
  it('reports missing files and JS syntax errors', () => {
    expect(testFiles(files)).toEqual([]);
    expect(testFiles({ ...files, 'js/app.js': 'let = ;' }).length).toBe(1);
    const { ['css/style.css']: _, ...rest } = files; expect(testFiles(rest)).toContain('index.html: css/style.css ফাইল নেই');
  });
});

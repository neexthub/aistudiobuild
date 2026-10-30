import type { FileMap } from './files';

/** Build step: inlines local CSS/JS files referenced by index.html into one runnable document. */
export function bundleHtml(files: FileMap): string | null {
  let html = files['index.html'];
  if (!html) return null;
  const norm = (p: string) => p.replace(/^\.?\//, '');
  html = html.replace(/<link[^>]*href=["']([^"':]+\.css)["'][^>]*>/gi, (tag, href: string) => {
    const css = files[norm(href)]; return css === undefined ? tag : `<style data-file="${norm(href)}">\n${css}\n</style>`;
  });
  html = html.replace(/<script([^>]*)src=["']([^"':]+\.js)["']([^>]*)><\/script>/gi, (tag, a: string, src: string, b: string) => {
    const js = files[norm(src)]; if (js === undefined) return tag;
    const module = /type=["']module["']/i.test(a + b) ? ' type="module"' : '';
    return `<script${module} data-file="${norm(src)}">\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>`;
  });
  return html;
}

/** Test step: static checks a real user would hit at runtime. */
export function testFiles(files: FileMap): string[] {
  const problems: string[] = [];
  const html = files['index.html'];
  if (!html) problems.push('index.html নেই');
  else {
    if (!/<html/i.test(html) || !/<\/html>/i.test(html)) problems.push('index.html অসম্পূর্ণ');
    for (const m of html.matchAll(/(?:href|src)=["']([^"':#]+\.(?:css|js))["']/gi)) if (files[m[1]!.replace(/^\.?\//, '')] === undefined) problems.push(`${m[1]} ফাইল নেই`);
  }
  for (const [path, content] of Object.entries(files)) {
    if (!content.trim()) problems.push(`${path} খালি`);
    if (path.endsWith('.js')) { try { if (!/^\s*(import|export)\s/m.test(content)) new Function(content); } catch (e) { problems.push(`${path}: JavaScript ত্রুটি — ${(e as Error).message}`); } }
    if (path.endsWith('.json')) { try { JSON.parse(content); } catch { problems.push(`${path}: অবৈধ JSON`); } }
  }
  return problems;
}

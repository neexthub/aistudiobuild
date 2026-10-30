import type { FileMap } from './files';

const norm = (p: string) => p.replace(/^\.?\//, '').split(/[?#]/)[0]!;

/** Inline local CSS/JS referenced by one HTML page. */
function inlinePage(files: FileMap, page: string): string | null {
  let html = files[page];
  if (html === undefined) return null;
  const dir = page.includes('/') ? page.slice(0, page.lastIndexOf('/') + 1) : '';
  const find = (ref: string) => files[norm(ref)] !== undefined ? norm(ref) : files[dir + norm(ref)] !== undefined ? dir + norm(ref) : null;
  html = html.replace(/<link[^>]*href=["']([^"':]+\.css)["'][^>]*>/gi, (tag, href: string) => {
    const p = find(href); return p ? `<style data-file="${p}">\n${files[p]!.replace(/<\/style/gi, '<\\/style')}\n</style>` : tag;
  });
  html = html.replace(/<script([^>]*)src=["']([^"':]+\.js)["']([^>]*)><\/script>/gi, (tag, a: string, src: string, b: string) => {
    const p = find(src); if (!p) return tag;
    const module = /type=["']module["']/i.test(a + b) ? ' type="module"' : '';
    return `<script${module} data-file="${p}">\n${files[p]!.replace(/<\/script/gi, '<\\/script')}\n</script>`;
  });
  return html;
}

export const htmlPages = (files: FileMap) => Object.keys(files).filter(p => p.endsWith('.html')).sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)));

/** Build step: one runnable document; links between local .html pages keep working inside the preview. */
export function bundleHtml(files: FileMap, entry = 'index.html'): string | null {
  const pages = htmlPages(files);
  if (!pages.length) return null;
  const start = files[entry] !== undefined ? entry : pages[0]!;
  const first = inlinePage(files, start)!;
  if (pages.length === 1) return first;
  const map: Record<string, string> = {};
  for (const p of pages) map[p] = inlinePage(files, p)!;
  const data = JSON.stringify(map).replace(/</g, '\\u003c');
  const router = `<script data-nb-router>(function(){if(window.__nbPages)return;window.__nbPages=${data};
function go(p){var k=p.replace(/^\\.?\\//,'').split(/[?#]/)[0]||'index.html';if(!window.__nbPages[k])return false;var h=window.__nbPages[k];document.open();document.write(h);document.close();setTimeout(bind,0);scrollTo(0,0);return true;}
function bind(){document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var href=a.getAttribute('href');if(!href||/^(https?:|mailto:|tel:|#|javascript:)/i.test(href))return;if(go(href))e.preventDefault();},true);}
window.__nbGo=go;bind();})();</script>`;
  return /<head[^>]*>/i.test(first) ? first.replace(/<head[^>]*>/i, m => m + router) : router + first;
}

/** Test step: static checks a real user would hit at runtime. */
export function testFiles(files: FileMap): string[] {
  const problems: string[] = [];
  const pages = htmlPages(files);
  if (!files['index.html']) problems.push('index.html নেই');
  for (const page of pages) {
    const html = files[page]!;
    if (!/<html/i.test(html) || !/<\/html>/i.test(html)) problems.push(`${page} অসম্পূর্ণ`);
    for (const m of html.matchAll(/(?:href|src)=["']([^"':#?]+\.(?:css|js|html))["']/gi)) if (files[norm(m[1]!)] === undefined) problems.push(`${page}: ${m[1]} ফাইল নেই`);
  }
  for (const [path, content] of Object.entries(files)) {
    if (!content.trim()) problems.push(`${path} খালি`);
    if (path.endsWith('.js')) { try { if (!/^\s*(import|export)\s/m.test(content)) new Function(content); } catch (e) { problems.push(`${path}: JavaScript ত্রুটি — ${(e as Error).message}`); } }
    if (path.endsWith('.json')) { try { JSON.parse(content); } catch { problems.push(`${path}: অবৈধ JSON`); } }
  }
  return problems;
}

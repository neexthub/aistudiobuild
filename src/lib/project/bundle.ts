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

/** Preview helpers injected into every page: in-memory localStorage when the sandbox blocks it, and local .html link routing. */
function runtime(pages: string[], store: Record<string, string>, embedded: string): string {
  return `<script data-nb-runtime>(function(){var S=${JSON.stringify(store).replace(/</g, '\\u003c')};
try{window.localStorage.getItem('x')}catch(e){var mk=function(){return{getItem:function(k){return Object.prototype.hasOwnProperty.call(S,k)?S[k]:null},setItem:function(k,v){S[k]=String(v)},removeItem:function(k){delete S[k]},clear:function(){for(var k in S)delete S[k]},key:function(i){return Object.keys(S)[i]||null},get length(){return Object.keys(S).length}}};Object.defineProperty(window,'localStorage',{value:mk(),configurable:true});Object.defineProperty(window,'sessionStorage',{value:mk(),configurable:true});}
var P=${JSON.stringify(pages)};${embedded}
function go(h){var k=h.replace(/^\\.?\\//,'').split(/[?#]/)[0]||'index.html';if(P.indexOf(k)<0)return false;
if(window.parent!==window){window.parent.postMessage({nbNav:k,store:S,pages:window.__nbPages||null},'*');return true;}
if(window.__nbPages){location.href=URL.createObjectURL(new Blob([window.__nbPages[k]],{type:'text/html'}));return true;}return false;}
window.__nbGo=go;document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href]');if(!a)return;var href=a.getAttribute('href');if(!href||/^(https?:|mailto:|tel:|#|javascript:|data:|blob:)/i.test(href))return;if(go(href))e.preventDefault();},true);})();</script>`;
}

/** Build step: one runnable page. `store` carries preview localStorage across page switches. `standalone` embeds all pages (for published links). */
export function bundleHtml(files: FileMap, entry = 'index.html', store: Record<string, string> = {}, standalone = false): string | null {
  const pages = htmlPages(files);
  if (!pages.length) return null;
  const start = files[entry] !== undefined ? entry : pages[0]!;
  const page = inlinePage(files, start)!;
  let embedded = '';
  if (standalone && pages.length > 1) { const map: Record<string, string> = {}; for (const p of pages) map[p] = inlinePage(files, p)!; embedded = `window.__nbPages=${JSON.stringify(map).replace(/</g, '\\u003c')};`; }
  const rt = runtime(pages, store, embedded);
  return /<head[^>]*>/i.test(page) ? page.replace(/<head[^>]*>/i, m => m + rt) : rt + page;
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

/** Published viewer: re-wrap a stored page with the runtime and the full page map. */
export function withRuntime(pageHtml: string, map: Record<string, string>, store: Record<string, string>): string {
  const rt = runtime(Object.keys(map), store, `window.__nbPages=${JSON.stringify(map).replace(/</g, '\\u003c')};`);
  return /<head[^>]*>/i.test(pageHtml) ? pageHtml.replace(/<head[^>]*>/i, m => m + rt) : rt + pageHtml;
}

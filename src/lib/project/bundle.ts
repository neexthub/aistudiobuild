import type { FileMap } from './files';

/** Build step: inlines local CSS/JS files referenced by index.html into one runnable document. */
export function bundleHtml(files: FileMap): string | null {
  if (isNextProject(files)) return bundleNext(files);
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
  if (isNextProject(files)) return testNext(files);
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

const SRC = /\.(tsx?|jsx?)$/;
export const isNextProject = (files: FileMap) => !files['index.html'] && Object.keys(files).some(p => /^(src\/)?app\/page\.(tsx|jsx|ts|js)$/.test(p));
const PKGS = /^(react|react-dom|react\/jsx-runtime|next\/link|next\/image|next\/navigation|next\/font\/google|lucide-react|clsx)$/;

/** Resolve an import from `from` to a project path, or null. */
export function resolveImport(files: FileMap, from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = (Object.keys(files).some(p => p.startsWith('src/')) && !files[spec.slice(2)] ? 'src/' : '') + spec.slice(2);
  else if (spec.startsWith('.')) { const parts = from.split('/').slice(0, -1); for (const seg of spec.split('/')) { if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg); } base = parts.join('/'); }
  else return null;
  for (const c of [base, ...['.tsx', '.ts', '.jsx', '.js', '.css'].map(e => base + e), ...['/index.tsx', '/index.ts', '/index.jsx', '/index.js'].map(e => base + e)]) if (files[c] !== undefined) return c;
  return null;
}

function testNext(files: FileMap): string[] {
  const problems: string[] = [];
  for (const [path, content] of Object.entries(files)) {
    if (!content.trim()) problems.push(`${path} খালি`);
    if (path.endsWith('.json')) { try { JSON.parse(content); } catch { problems.push(`${path}: অবৈধ JSON`); } }
    if (!SRC.test(path)) continue;
    for (const m of content.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g)) {
      const spec = (m[1] ?? m[2])!;
      if (spec.startsWith('.') || spec.startsWith('@/')) { if (!resolveImport(files, path, spec)) problems.push(`${path}: '${spec}' ফাইল নেই`); }
      else if (!PKGS.test(spec)) problems.push(`${path}: '${spec}' প্যাকেজ প্রিভিউতে নেই`);
    }
    if (/\b(useState|useEffect|onClick|useRouter)\b/.test(content) && !/^\s*['"]use client['"]/.test(content) && /^(src\/)?(app|components)\//.test(path)) problems.push(`${path}: 'use client' দরকার`);
  }
  return problems;
}

/** Browser preview of a Next.js App Router project: Babel-compiles each file, wires a tiny module loader with next/* shims and hash routing. */
function bundleNext(files: FileMap): string {
  const mods: Record<string, string> = {}, css: string[] = [];
  for (const [p, c] of Object.entries(files)) { if (SRC.test(p) && !/(^|\/)(next|tailwind|postcss)\.config/.test(p) && !p.endsWith('.d.ts')) mods[p] = c; else if (p.endsWith('.css')) css.push(c.replace(/@tailwind[^;]*;|@import\s+["']tailwindcss[^;]*;/g, '')); }
  const appDir = files['src/app/page.tsx'] !== undefined || Object.keys(files).some(p => p.startsWith('src/app/')) ? 'src/app/' : 'app/';
  const routes = Object.keys(mods).filter(p => p.startsWith(appDir) && /\/page\.(tsx|jsx|ts|js)$/.test(p)).map(p => ({ path: '/' + p.slice(appDir.length).replace(/\/?page\.\w+$/, '').replace(/\([^)]+\)\/?/g, ''), file: p }));
  const layout = Object.keys(mods).find(p => new RegExp(`^${appDir}layout\\.(tsx|jsx)$`).test(p)) ?? '';
  const data = JSON.stringify({ mods, routes, layout, files: Object.keys(files) }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.tailwindcss.com"></script>
<script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.development.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>
<script src="https://unpkg.com/lucide-react@0.460.0/dist/umd/lucide-react.min.js"></script>
<style>${css.join('\n').replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="root"></div>
<script>
(function(){
const D=${data}; const cache={}; const R=React;
function show(e){document.getElementById('root').innerHTML='<pre style="color:#b91c1c;padding:16px;white-space:pre-wrap;font:12px monospace">⚠ '+String(e&&e.stack||e).replace(/</g,'&lt;')+'</pre>';console.error(e);}
function resolve(from,spec){let base;if(spec.startsWith('@/')){base=spec.slice(2);if(!D.files.includes(base)&&D.files.some(f=>f.startsWith('src/')))base='src/'+base;}else{const parts=from.split('/').slice(0,-1);for(const s of spec.split('/')){if(s==='..')parts.pop();else if(s!=='.')parts.push(s);}base=parts.join('/');}
for(const c of [base,base+'.tsx',base+'.ts',base+'.jsx',base+'.js',base+'.css',base+'/index.tsx',base+'/index.ts',base+'/index.js'])if(D.files.includes(c))return c;throw new Error('মডিউল পাওয়া যায়নি: '+spec+' ('+from+')');}
let navTo=null; const nav=h=>{location.hash=h;};
const Link=R.forwardRef(function(p,ref){const {href,children,...rest}=p;const to=typeof href==='string'?href:(href&&href.pathname)||'/';const ext=/^(https?:|mailto:|tel:)/.test(to);return R.createElement('a',{...rest,ref,href:ext?to:'#'+to,onClick:e=>{rest.onClick&&rest.onClick(e);}},children);});
const Img=function(p){const {src,alt,fill,priority,quality,placeholder,blurDataURL,loader,unoptimized,...rest}=p;return R.createElement('img',{src:typeof src==='string'?src:src&&src.src,alt,...rest,style:fill?{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',...(rest.style||{})}:rest.style});};
const cur=()=>(location.hash.slice(1)||'/').split('?')[0];
const navigation={useRouter:()=>({push:nav,replace:nav,back:()=>history.back(),forward:()=>history.forward(),refresh:()=>{},prefetch:()=>{}}),usePathname:()=>cur(),useSearchParams:()=>new URLSearchParams(location.hash.split('?')[1]||''),useParams:()=>(window.__params||{}),redirect:nav,notFound:()=>{throw new Error('404');}};
const fontShim=new Proxy({},{get:()=>()=>({className:'',variable:'',style:{}})});
const ext={'react':R,'react-dom':ReactDOM,'react/jsx-runtime':{jsx:(t,p,k)=>R.createElement(t,{...p,key:k}),jsxs:(t,p,k)=>R.createElement(t,{...p,key:k}),Fragment:R.Fragment},'next/link':{__esModule:true,default:Link},'next/image':{__esModule:true,default:Img},'next/navigation':navigation,'next/font/google':fontShim,'lucide-react':new Proxy(window.LucideReact||window.lucideReact||{},{get:(t,k)=>t[k]||(k==='__esModule'?false:function(p){return R.createElement('span',{className:p&&p.className,style:{display:'inline-block',width:(p&&p.size)||24,height:(p&&p.size)||24}})})}),'clsx':{__esModule:true,default:(...a)=>a.flat().filter(Boolean).join(' ')}};
function load(p){if(cache[p])return cache[p].exports;if(p.endsWith('.css'))return {};const m={exports:{}};cache[p]=m;
const code=Babel.transform(D.mods[p],{filename:p,presets:[['typescript',{isTSX:true,allExtensions:true}],['react',{runtime:'classic'}]],plugins:['transform-modules-commonjs']}).code;
const req=s=>{if(ext[s])return ext[s];if(s.startsWith('.')||s.startsWith('@/'))return load(resolve(p,s));console.warn('প্যাকেজ নেই:',s);return new Proxy({},{get:()=>()=>null});};
new Function('require','module','exports','React','process',code)(req,m,m.exports,R,{env:{NODE_ENV:'development'}});return m.exports;}
const def=m=>m&&(m.default||Object.values(m).find(v=>typeof v==='function'));
function match(path){for(const r of D.routes){const keys=[];const re=new RegExp('^'+r.path.replace(/\\[(?:\\.\\.\\.)?([^\\]]+)\\]/g,(_,k)=>{keys.push(k);return '([^/]+)';})+'/?$');const mm=path.match(re);if(mm){const params={};keys.forEach((k,i)=>params[k]=decodeURIComponent(mm[i+1]));return {r,params};}}return null;}
function render(){try{const path=cur();const hit=match(path);window.__params=hit?hit.params:{};const Page=hit?def(load(hit.r.file)):()=>R.createElement('div',{style:{padding:24}},'404 — '+path);
const L=D.layout?def(load(D.layout)):null;let tree=R.createElement(Page,{params:window.__params,searchParams:{}});
if(L){tree=R.createElement(L,null,tree);} const Shell=()=>tree;
// layouts render <html><body>; strip those wrappers for the preview
const strip=el=>{if(!R.isValidElement(el))return el;if(el.type==='html'||el.type==='body'||el.type==='head')return R.createElement(R.Fragment,null,R.Children.map(el.props.children,strip));return el;};
const Root=()=>{const out=L?strip(L({children:R.createElement(Page,{params:window.__params,searchParams:{}})})):tree;return out;};
if(!window.__root)window.__root=ReactDOM.createRoot(document.getElementById('root'));window.__root.render(R.createElement(Root));}catch(e){show(e);}}
window.addEventListener('hashchange',render);window.addEventListener('error',e=>show(e.error||e.message));render();
})();
</script></body></html>`;
}

import type { FileMap } from './files';

/** Multi-page HTML/CSS/JS starter. */
export function htmlTemplate(): FileMap {
  const nav = '<nav class="nav"><a href="index.html">হোম</a><a href="about.html">আমাদের সম্পর্কে</a></nav>';
  const page = (title: string, body: string) => `<!doctype html>\n<html lang="bn">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>${title}</title>\n<link rel="stylesheet" href="css/style.css">\n</head>\n<body>\n${nav}\n<main>${body}</main>\n<script src="js/app.js"></script>\n</body>\n</html>\n`;
  return {
    'index.html': page('আমার নতুন অ্যাপ', '<h1>আমার নতুন অ্যাপ</h1><button id="count">গণনা: 0</button>'),
    'about.html': page('আমাদের সম্পর্কে', '<h1>আমাদের সম্পর্কে</h1><p>এটি একটি বহু-পাতার HTML অ্যাপ।</p>'),
    'css/style.css': 'body{margin:0;font-family:system-ui,sans-serif;background:#14181b;color:#f0f5f3}\n.nav{display:flex;gap:16px;padding:16px 24px;border-bottom:1px solid #2a3035}\n.nav a{color:#65dfad;text-decoration:none}\nmain{max-width:960px;margin:auto;padding:48px 24px}\nbutton{border:0;border-radius:6px;padding:12px 20px;background:#65dfad;color:#14181b;cursor:pointer}\n',
    'js/app.js': 'const btn = document.getElementById("count");\nlet n = 0;\nif (btn) btn.addEventListener("click", () => { n += 1; btn.textContent = "গণনা: " + n; });\n',
  };
}

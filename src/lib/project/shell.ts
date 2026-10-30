import { applyOperations, contentHash, type FileMap, type FileOperation } from './files';
import { bundleHtml, testFiles } from './bundle';

export type ShellResult = { output: string; files: FileMap; changed: boolean };
export const SHELL_HELP = `কমান্ড: ls · tree · cat <file> · touch <file> · write <file> <<EOF … EOF · append <file> <<EOF … EOF · replace <file> <<EOF\\nপুরোনো\\n---\\nনতুন\\nEOF · rm <file> · mv <from> <to> · grep <text> · test · build · clear · help`;

/** Split a script into commands; heredoc bodies stay attached to their command. */
export function parseScript(script: string): { line: string; body?: string }[] {
  const lines = script.replace(/\r/g, '').split('\n'), out: { line: string; body?: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim(); if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(.*?)\s*<<\s*'?(\w+)'?$/);
    if (m) { const body: string[] = []; i++; while (i < lines.length && lines[i].trim() !== m[2]) body.push(lines[i++]); out.push({ line: m[1], body: body.join('\n') }); }
    else out.push({ line });
  }
  return out;
}

/** Run one virtual command against the project file map. Never touches the host machine. */
export function runCommand(files: FileMap, line: string, body?: string): ShellResult {
  const [cmd, ...args] = line.trim().split(/\s+/), a = args[0] ?? '';
  const ok = (output: string) => ({ output, files, changed: false });
  const apply = (ops: FileOperation[], output: string) => ({ output, files: applyOperations(files, ops), changed: true });
  const need = () => { if (files[a] === undefined) throw new Error(`ফাইল নেই: ${a}`); return files[a]; };
  switch (cmd) {
    case 'help': return ok(SHELL_HELP);
    case 'ls': return ok(Object.keys(files).filter(p => p.startsWith(a)).sort().join('\n') || '(খালি)');
    case 'tree': return ok(Object.keys(files).sort().map(p => '  '.repeat(p.split('/').length - 1) + '└ ' + p.split('/').at(-1)).join('\n') || '(খালি)');
    case 'cat': return ok(need());
    case 'grep': { const q = args.join(' '); return ok(Object.entries(files).flatMap(([p, c]) => c.split('\n').map((l, i) => l.includes(q) ? `${p}:${i + 1}: ${l.trim()}` : '').filter(Boolean)).slice(0, 80).join('\n') || 'মিল পাওয়া যায়নি'); }
    case 'touch': return files[a] !== undefined ? ok(`আছে: ${a}`) : apply([{ op: 'create', path: a, content: '' }], `+ ${a}`);
    case 'write': if (body === undefined) throw new Error('write-এর পরে <<EOF … EOF দিন');
      return files[a] === undefined ? apply([{ op: 'create', path: a, content: body + '\n' }], `+ ${a} (${body.split('\n').length} লাইন)`) : apply([{ op: 'update', path: a, expectedHash: contentHash(files[a]), content: body + '\n' }], `~ ${a} (${body.split('\n').length} লাইন)`);
    case 'append': { const old = need(); return apply([{ op: 'update', path: a, expectedHash: contentHash(old), content: old + (body ?? args.slice(1).join(' ')) + '\n' }], `~ ${a} (যোগ)`); }
    case 'replace': { const old = need(), [from, to] = (body ?? '').split(/\n---\n/); if (!from || to === undefined || !old.includes(from)) throw new Error(`replace: পুরোনো লেখা পাওয়া যায়নি ${a}-এ`); return apply([{ op: 'update', path: a, expectedHash: contentHash(old), content: old.replace(from, to) }], `~ ${a} (প্রতিস্থাপন)`); }
    case 'rm': return apply([{ op: 'delete', path: a, expectedHash: contentHash(need()) }], `− ${a}`);
    case 'mv': { const c = need(); return apply([{ op: 'create', path: args[1], content: c }, { op: 'delete', path: a, expectedHash: contentHash(c) }], `${a} → ${args[1]}`); }
    case 'test': { const issues = testFiles(files); return ok(issues.length ? '✗ ' + issues.join('\n✗ ') : '✓ সব স্ট্যাটিক টেস্ট পাস'); }
    case 'build': { const html = bundleHtml(files); return ok(html ? `✓ বিল্ড সফল (${(html.length / 1024).toFixed(1)} KB)` : '✗ index.html নেই, বিল্ড হয়নি'); }
    default: throw new Error(`অজানা কমান্ড: ${cmd} — help লিখুন`);
  }
}

/** Run a whole script; stops at the first error and keeps changes made before it. */
export function runScript(files: FileMap, script: string) {
  const log: { cmd: string; output: string; error?: boolean }[] = []; let current = files;
  for (const { line, body } of parseScript(script)) {
    try { const r = runCommand(current, line, body); current = r.files; log.push({ cmd: line, output: r.output }); }
    catch (e) { log.push({ cmd: line, output: (e as Error).message, error: true }); break; }
  }
  return { files: current, log };
}

export const SHELL_AGENT_PROMPT = `তুমি NextBuild Shell Agent। শুধু বাংলায় এক লাইনে কী করবে বলো, তারপর একটি \`\`\`sh ব্লকে কমান্ড দাও।
কমান্ডগুলো প্রজেক্টের ভার্চুয়াল ফাইলে চলে: ${SHELL_HELP}
নিয়ম: পুরো ফাইল লিখতে write ব্যবহার করো; ছোট পরিবর্তনে replace। প্রিভিউ index.html থেকে চলে (style.css, script.js লিংক করা যাবে)। শেষে test এবং build চালাও।`;

export type FileMap = Record<string, string>;
export type Revision = { id: string; label: string; createdAt: number; files: FileMap };
export type FileOperation = { op: 'create'; path: string; content: string } | { op: 'update'; path: string; expectedHash: string; content: string } | { op: 'delete'; path: string; expectedHash: string };
export const MAX_FILES = 150;
export const MAX_BYTES = 2_000_000;
export function validPath(path: string) {
  const parts = path.split('/');
  return path.length <= 180 && !path.startsWith('/') && !path.includes('\\') && /^[a-zA-Z0-9_./@()\[\]-]+$/.test(path) && parts.every(p => !!p && p !== '.' && p !== '..' && !['.git', 'node_modules', 'dist', '.next', 'accounts', 'sessions'].includes(p) && !p.startsWith('.env'));
}
export function contentHash(text: string) {
  let h = 2166136261;
  for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
export function validateFiles(files: FileMap) {
  const entries = Object.entries(files);
  if (entries.length > MAX_FILES) throw new Error('সর্বোচ্চ ১৫০টি ফাইল রাখা যাবে।');
  let bytes = 0;
  for (const [path, content] of entries) {
    if (!validPath(path) || typeof content !== 'string') throw new Error(`অনুমোদিত ফাইলের নাম নয়: ${path}`);
    bytes += new TextEncoder().encode(content).length;
  }
  if (bytes > MAX_BYTES) throw new Error('প্রজেক্টের source সর্বোচ্চ ২ MB হতে পারবে।');
  return files;
}
export function applyOperations(files: FileMap, operations: FileOperation[], allowedPaths?: string[]): FileMap {
  const result = { ...files };
  const touched = new Set<string>();
  for (const operation of operations) {
    const { path } = operation;
    if (!validPath(path) || touched.has(path) || (allowedPaths && !allowedPaths.includes(path))) throw new Error(`ফাইলের অনুমতি বা duplicate operation সমস্যা: ${path}`);
    touched.add(path);
    const old = result[path];
    if (operation.op === 'create') {
      if (old !== undefined) throw new Error(`ফাইল আগে থেকেই আছে: ${path}`);
      result[path] = operation.content;
    } else {
      if (old === undefined || contentHash(old) !== operation.expectedHash) throw new Error(`ফাইল বদলেছে, পুনরায় পড়ুন: ${path}`);
      if (operation.op === 'delete') delete result[path]; else result[path] = operation.content;
    }
  }
  return validateFiles(result);
}
export function legacyFiles(html: string): FileMap { return html ? { 'index.html': html } : {}; }
export function fileChanges(before: FileMap, after: FileMap) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().filter(path => before[path] !== after[path]).map(path => ({ path, kind: before[path] === undefined ? 'added' : after[path] === undefined ? 'deleted' : 'changed' }));
}

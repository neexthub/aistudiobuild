// File-based JSON store. Each "file" (users.json, projects.json) is a JSON
// document kept in browser storage, read and written whole like a file.
import { applyOperations, contentHash, legacyFiles, validateFiles, type FileMap, type FileOperation, type Revision } from './project/files';
import type { RunRecord } from './agents/contracts';
export type User = { id: string; name: string; email: string; pass: string; createdAt: number };
export type ChatMsg = { role: "user" | "assistant"; content: string; model?: string; images?: string[] };
export type Project = {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  html: string;
  messages: ChatMsg[];
  published: boolean;
  publishedHtml?: string;
  createdAt: number;
  updatedAt: number;
  schemaVersion?: 2;
  files?: FileMap;
  revisions?: Revision[];
  runs?: RunRecord[];
  kind?: 'html' | 'next';
  /** Image links (uploaded or AI-generated) agents may embed. */
  assets?: string[];
  suggestions?: string[];
};

type Files = { "users.json": User[]; "projects.json": Project[]; "session.json": { userId: string | null } };

const mem: Record<string, string> = {};
const storage = {
  get: (k: string) => (typeof localStorage !== "undefined" ? localStorage.getItem(k) : (mem[k] ?? null)),
  set: (k: string, v: string) => (typeof localStorage !== "undefined" ? localStorage.setItem(k, v) : void (mem[k] = v)),
};

const defaults: Files = { "users.json": [], "projects.json": [], "session.json": { userId: null } };

export function readFile<K extends keyof Files>(name: K): Files[K] {
  const raw = storage.get("nextbuild/" + name);
  if (!raw) return structuredClone(defaults[name]);
  try { return JSON.parse(raw); } catch { return structuredClone(defaults[name]); }
}
export function writeFile<K extends keyof Files>(name: K, data: Files[K]) {
  storage.set("nextbuild/" + name, JSON.stringify(data, null, 2));
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const hash = (s: string) => { let h = 5381; for (const c of s) h = ((h << 5) + h + c.charCodeAt(0)) | 0; return String(h >>> 0); };

export function slugify(s: string) {
  const base = s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return base || "app";
}

// ---- users ----
export function signUp(name: string, email: string, pass: string): User {
  const users = readFile("users.json");
  email = email.trim().toLowerCase();
  if (!name.trim() || !email || pass.length < 4) throw new Error("নাম, ইমেইল ও কমপক্ষে ৪ অক্ষরের পাসওয়ার্ড দিন");
  if (users.some((u) => u.email === email)) throw new Error("এই ইমেইলে আগেই অ্যাকাউন্ট আছে");
  const user = { id: uid(), name: name.trim(), email, pass: hash(pass), createdAt: Date.now() };
  writeFile("users.json", [...users, user]);
  writeFile("session.json", { userId: user.id });
  return user;
}
export function signIn(email: string, pass: string): User {
  const u = readFile("users.json").find((x) => x.email === email.trim().toLowerCase());
  if (!u || u.pass !== hash(pass)) throw new Error("ইমেইল বা পাসওয়ার্ড ভুল");
  writeFile("session.json", { userId: u.id });
  return u;
}
export function signOut() { writeFile("session.json", { userId: null }); }
export function currentUser(): User | null {
  const { userId } = readFile("session.json");
  return readFile("users.json").find((u) => u.id === userId) ?? null;
}

// ---- projects ----
export function listProjects(ownerId: string) {
  return readFile("projects.json").filter((p) => p.ownerId === ownerId).map(migrateProject).sort((a, b) => b.updatedAt - a.updatedAt);
}
export function migrateProject(project: Project): Project {
  return { ...project, schemaVersion: 2, files: project.files ?? legacyFiles(project.html), revisions: project.revisions ?? [], runs: project.runs ?? [], kind: project.kind ?? 'html' };
}
export function getProject(id: string) { const p = readFile("projects.json").find((p) => p.id === id); return p ? migrateProject(p) : null; }
export function getPublished(slug: string) {
  return readFile("projects.json").find((p) => p.slug === slug && p.published) ?? null;
}
function uniqueSlug(name: string, exceptId?: string) {
  const all = readFile("projects.json");
  const base = slugify(name);
  let s = base, i = 2;
  while (all.some((p) => p.slug === s && p.id !== exceptId)) s = `${base}-${i++}`;
  return s;
}
export function createProject(ownerId: string, name: string): Project {
  const now = Date.now();
  const p: Project = { id: uid(), ownerId, name: name.trim() || "নতুন অ্যাপ", slug: uniqueSlug(name), html: "", messages: [], published: false, createdAt: now, updatedAt: now, schemaVersion: 2, files: {}, revisions: [], runs: [], kind: 'html' };
  writeFile("projects.json", [...readFile("projects.json"), p]);
  return p;
}
export function updateProject(id: string, patch: Partial<Omit<Project, "id" | "ownerId">>) {
  const all = readFile("projects.json");
  const i = all.findIndex((p) => p.id === id);
  if (i < 0) return null;
  const existing = all[i];
  if (!existing) return null;
  const next = { ...migrateProject(existing), ...patch, updatedAt: Date.now() };
  if (patch.html !== undefined && !patch.files && next.kind === 'html') next.files = legacyFiles(patch.html);
  if (patch.name) next.slug = uniqueSlug(patch.name, id);
  all[i] = next;
  writeFile("projects.json", all);
  return next;
}
export function deleteProject(id: string) {
  writeFile("projects.json", readFile("projects.json").filter((p) => p.id !== id));
}
export function publishProject(id: string) {
  const p = getProject(id);
  if (!p || !p.html) throw new Error("আগে অ্যাপ বানান, তারপর পাবলিশ করুন");
  const updated = updateProject(id, { published: true, publishedHtml: p.html });
  if (!updated) throw new Error('প্রজেক্টটি পাওয়া যায়নি।');
  return updated;
}

export function saveProjectFiles(id: string, files: FileMap, label: string, kind?: 'html' | 'next') {
  const p = getProject(id);
  if (!p) throw new Error('প্রজেক্টটি পাওয়া যায়নি।');
  validateFiles(files);
  const revision = { id: uid(), createdAt: Date.now(), label, files: structuredClone(files) };
  const updated = updateProject(id, { files, revisions: [...(p.revisions ?? []), revision].slice(-20), kind: kind ?? p.kind ?? 'html', html: files['index.html'] ?? '' });
  if (!updated) throw new Error('প্রজেক্ট সংরক্ষণ হয়নি।');
  return updated;
}
export function editProjectFiles(id: string, operations: FileOperation[]) {
  const p = getProject(id);
  if (!p) throw new Error('প্রজেক্টটি পাওয়া যায়নি।');
  return saveProjectFiles(id, applyOperations(p.files ?? {}, operations), 'ফাইল পরিবর্তন');
}
export function restoreRevision(id: string, revisionId: string) {
  const p = getProject(id);
  const revision = p?.revisions?.find(r => r.id === revisionId);
  if (!revision) throw new Error('সংস্করণ পাওয়া যায়নি।');
  return saveProjectFiles(id, revision.files, 'ফিরিয়ে আনা: ' + revision.label);
}
export { contentHash };

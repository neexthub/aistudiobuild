// File-based JSON store. Each "file" (users.json, projects.json) is a JSON
// document kept in browser storage, read and written whole like a file.
export type User = { id: string; name: string; email: string; pass: string; createdAt: number };
export type ChatMsg = { role: "user" | "assistant"; content: string; model?: string };
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
  return readFile("projects.json").filter((p) => p.ownerId === ownerId).sort((a, b) => b.updatedAt - a.updatedAt);
}
export function getProject(id: string) { return readFile("projects.json").find((p) => p.id === id) ?? null; }
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
  const p: Project = { id: uid(), ownerId, name: name.trim() || "নতুন অ্যাপ", slug: uniqueSlug(name), html: "", messages: [], published: false, createdAt: now, updatedAt: now };
  writeFile("projects.json", [...readFile("projects.json"), p]);
  return p;
}
export function updateProject(id: string, patch: Partial<Omit<Project, "id" | "ownerId">>) {
  const all = readFile("projects.json");
  const i = all.findIndex((p) => p.id === id);
  if (i < 0) return null;
  const next = { ...all[i], ...patch, updatedAt: Date.now() };
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
  return updateProject(id, { published: true, publishedHtml: p.html })!;
}

import { z } from 'zod';
import { validPath } from '@/lib/project/files';
export const AGENT_ROLES = ['planner', 'coder', 'quality', 'test', 'build', 'publish'] as const;
export const MAX_PARALLEL = 4;
export const taskSchema = z.object({ id: z.string().min(1).max(60), role: z.string().min(1).max(60), objective: z.string().min(1).max(1500), dependsOn: z.array(z.string()).max(20), readPaths: z.array(z.string().refine(validPath)).max(150), writePaths: z.array(z.string().refine(validPath)).min(1).max(30), acceptanceChecks: z.array(z.string().max(300)).min(1).max(15) }).strict();
export const planSchema = z.object({ summaryBn: z.string().min(1).max(2000), tasks: z.array(taskSchema).min(1).max(24) }).strict();
export type AgentPlan = z.infer<typeof planSchema>;
export type AgentTask = z.infer<typeof taskSchema>;
const path = z.string().refine(validPath);
export const operationSchema = z.discriminatedUnion('op', [z.object({ op: z.literal('create'), path, content: z.string() }).strict(), z.object({ op: z.literal('update'), path, expectedHash: z.string(), content: z.string() }).strict(), z.object({ op: z.literal('delete'), path, expectedHash: z.string() }).strict()]);
export const reviewSchema = z.object({ summaryBn: z.string(), pass: z.boolean(), issues: z.array(z.string()).max(30), operations: z.array(operationSchema).max(30) });
export const outputSchema = z.object({ summaryBn: z.string(), operations: z.array(operationSchema).min(1).max(30), checks: z.array(z.string()).max(20) }).strict();
export type TaskState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type RunRecord = { id: string; createdAt: number; goal: string; state: 'planning' | 'running' | 'reviewing' | 'completed' | 'failed' | 'cancelled'; summary: string; tasks: Array<AgentTask & { state: TaskState }>; logs: string[] };
/** Repairs common model slips (missing arrays, extra keys, dangling deps) before strict validation. */
export function normalizePlan(input: unknown): unknown {
  const raw = (input ?? {}) as { summaryBn?: unknown; tasks?: unknown };
  const arr = (v: unknown) => Array.isArray(v) ? v.filter(x => typeof x === 'string') as string[] : [];
  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : []).map((t: Record<string, unknown>, i: number) => ({
    id: String(t.id ?? `task-${i + 1}`).slice(0, 60), role: String(t.role ?? 'builder').slice(0, 60), objective: String(t.objective ?? t.description ?? 'কাজ').slice(0, 1500),
    dependsOn: arr(t.dependsOn), readPaths: arr(t.readPaths).filter(validPath), writePaths: arr(t.writePaths ?? t.files).filter(validPath).slice(0, 30),
    acceptanceChecks: arr(t.acceptanceChecks).length ? arr(t.acceptanceChecks).map(c => c.slice(0, 300)).slice(0, 15) : ['কাজ সম্পূর্ণ'],
  })).filter(t => t.writePaths.length).slice(0, 24);
  const ids = new Set(tasks.map(t => t.id));
  tasks.forEach(t => { t.dependsOn = t.dependsOn.filter(d => ids.has(d) && d !== t.id); });
  return { summaryBn: String(raw.summaryBn ?? 'পরিকল্পনা প্রস্তুত').slice(0, 2000), tasks };
}
export function validatePlan(input: unknown): AgentPlan {
  const plan = planSchema.parse(normalizePlan(input));
  const byId = new Map(plan.tasks.map(task => [task.id, task]));
  if (byId.size !== plan.tasks.length) throw new Error('পরিকল্পনায় duplicate task ID আছে।');
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(id: string) {
    if (visiting.has(id)) throw new Error('পরিকল্পনার dependency cycle পাওয়া গেছে।');
    if (visited.has(id)) return;
    const task = byId.get(id);
    if (!task) throw new Error('Dependency task পাওয়া যায়নি।');
    visiting.add(id); task.dependsOn.forEach(visit); visiting.delete(id); visited.add(id);
  }
  plan.tasks.forEach(task => visit(task.id));
  return plan;
}
/** Runs every dependency-ready task in parallel (up to MAX_PARALLEL) as long as
 * running tasks never write the same file. */
export async function executePlan(plan: AgentPlan, signal: AbortSignal, execute: (task: AgentTask) => Promise<void>, status: (id: string, state: TaskState) => void, limit = MAX_PARALLEL) {
  const pending = [...plan.tasks], done = new Set<string>(), running = new Map<string, Promise<void>>(), writing = new Set<string>();
  let failure: unknown = null;
  while (pending.length || running.size) {
    if (signal.aborted && !failure) failure = new DOMException('Stopped', 'AbortError');
    if (!failure) {
      for (let i = 0; i < pending.length && running.size < limit;) {
        const task = pending[i]!;
        if (!task.dependsOn.every(id => done.has(id)) || task.writePaths.some(p => writing.has(p))) { i++; continue; }
        pending.splice(i, 1); task.writePaths.forEach(p => writing.add(p)); status(task.id, 'running');
        running.set(task.id, execute(task).then(() => { done.add(task.id); status(task.id, 'completed'); }, error => { status(task.id, signal.aborted ? 'cancelled' : 'failed'); failure ??= error; }).finally(() => { running.delete(task.id); task.writePaths.forEach(p => writing.delete(p)); }));
      }
    }
    if (failure && !running.size) { pending.forEach(t => status(t.id, 'cancelled')); throw failure; }
    if (!running.size) throw new Error('Task dependency resolve হয়নি।');
    await Promise.race(running.values());
  }
}
export function jsonReply(text: string): unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}

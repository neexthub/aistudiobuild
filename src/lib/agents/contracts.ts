import { z } from 'zod';
import { validPath } from '@/lib/project/files';
export const TEXT_MODELS = { coder: 'qwen2.5-coder:14b', planner: 'qwen2.5:14b' } as const;
export const taskSchema = z.object({ id: z.string().min(1).max(60), role: z.string().min(1).max(60), objective: z.string().min(1).max(1500), dependsOn: z.array(z.string()).max(20), readPaths: z.array(z.string().refine(validPath)).max(150), writePaths: z.array(z.string().refine(validPath)).min(1).max(30), acceptanceChecks: z.array(z.string().max(300)).min(1).max(15) }).strict();
export const planSchema = z.object({ summaryBn: z.string().min(1).max(2000), tasks: z.array(taskSchema).min(1).max(24) }).strict();
export type AgentPlan = z.infer<typeof planSchema>;
export type AgentTask = z.infer<typeof taskSchema>;
const path = z.string().refine(validPath);
export const operationSchema = z.discriminatedUnion('op', [z.object({ op: z.literal('create'), path, content: z.string() }).strict(), z.object({ op: z.literal('update'), path, expectedHash: z.string(), content: z.string() }).strict(), z.object({ op: z.literal('delete'), path, expectedHash: z.string() }).strict()]);
export const outputSchema = z.object({ summaryBn: z.string(), operations: z.array(operationSchema).min(1).max(30), checks: z.array(z.string()).max(20) }).strict();
export type TaskState = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type RunRecord = { id: string; createdAt: number; goal: string; state: 'planning' | 'running' | 'completed' | 'failed' | 'cancelled'; summary: string; tasks: Array<AgentTask & { state: TaskState }>; logs: string[] };
export function validatePlan(input: unknown): AgentPlan {
  const plan = planSchema.parse(input);
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
export async function executePlan(plan: AgentPlan, signal: AbortSignal, execute: (task: AgentTask) => Promise<void>, status: (id: string, state: TaskState) => void) {
  const pending = [...plan.tasks], done = new Set<string>();
  while (pending.length) {
    if (signal.aborted) { pending.forEach(task => status(task.id, 'cancelled')); throw new DOMException('Stopped', 'AbortError'); }
    const i = pending.findIndex(task => task.dependsOn.every(id => done.has(id)));
    const task = pending[i];
    if (!task || i < 0) throw new Error('Task dependency resolve হয়নি।');
    pending.splice(i, 1); status(task.id, 'running');
    try { await execute(task); done.add(task.id); status(task.id, 'completed'); }
    catch (error) { status(task.id, signal.aborted ? 'cancelled' : 'failed'); pending.forEach(t => status(t.id, 'cancelled')); throw error; }
  }
}
export function jsonReply(text: string): unknown {
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
}

import { checkStatus, streamChat } from '@/lib/ai';
import { applyOperations, contentHash, type FileMap } from '@/lib/project/files';
import { CODER_SYSTEM, PLANNER_SYSTEM } from './prompts';
import { executePlan, jsonReply, outputSchema, TEXT_MODELS, validatePlan, type RunRecord } from './contracts';
export async function buildWithAgents(goal: string, files: FileMap, signal: AbortSignal, changed: (run: RunRecord) => void, token: (value: string) => void): Promise<FileMap> {
  const status = await checkStatus();
  const missing = Object.values(TEXT_MODELS).filter(model => !status.models.includes(model));
  if (!status.ok || missing.length) throw new Error(status.ok ? `VPS-এ model নেই: ${missing.join(', ')}। VPS নির্দেশনা অনুসরণ করে ইনস্টল করুন।` : 'VPS-এ সংযোগ হচ্ছে না।');
  let run: RunRecord = { id: crypto.randomUUID(), createdAt: Date.now(), goal, state: 'planning', summary: 'পরিকল্পনা তৈরি হচ্ছে', tasks: [], logs: ['দুটি নির্বাচিত model পাওয়া গেছে।'] };
  const notify = () => changed(structuredClone(run));
  notify();
  try {
    const planText = await streamChat({ model: TEXT_MODELS.planner, system: PLANNER_SYSTEM, messages: [{ role: 'user', content: JSON.stringify({ goal, files: Object.keys(files) }) }], format: 'json', signal, onToken: token });
    const plan = validatePlan(jsonReply(planText));
    let candidate = { ...files };
    run = { ...run, state: 'running', summary: plan.summaryBn, tasks: plan.tasks.map(task => ({ ...task, state: 'queued' })) }; notify();
    await executePlan(plan, signal, async task => {
      const context = [...new Set([...task.readPaths, ...task.writePaths])].filter(path => candidate[path] !== undefined).map(path => ({ path, hash: contentHash(candidate[path] ?? ''), content: candidate[path] }));
      const content = JSON.stringify({ goal, task, fileList: Object.keys(candidate), context });
      if (content.length > 10500) throw new Error(`${task.id}: context বড়; কাজটি ছোট file-scoped task-এ ভাগ করুন।`);
      token('');
      const reply = await streamChat({ model: TEXT_MODELS.coder, system: CODER_SYSTEM, messages: [{ role: 'user', content }], signal, format: 'json', onToken: token });
      const result = outputSchema.parse(jsonReply(reply));
      if (result.operations.some(op => op.op === 'delete')) throw new Error('এজেন্টের file deletion অনুমোদিত নয়।');
      candidate = applyOperations(candidate, result.operations, task.writePaths);
      run.logs.push(`${task.id}: ${result.summaryBn}`, ...result.checks.map(c => `পরীক্ষা প্রয়োজন: ${c}`)); notify();
    }, (id, state) => { run.tasks = run.tasks.map(task => task.id === id ? { ...task, state } : task); notify(); });
    run.state = 'completed'; run.logs.push('Source operations যাচাই হয়েছে; প্রকৃত Next.js build-এর জন্য VPS runner প্রয়োজন।'); notify();
    return candidate;
  } catch (error) {
    run.state = signal.aborted ? 'cancelled' : 'failed';
    run.logs.push(error instanceof Error ? error.message : 'কাজ ব্যর্থ হয়েছে।'); notify(); throw error;
  }
}

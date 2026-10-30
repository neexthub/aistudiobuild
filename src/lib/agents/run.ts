import { streamChat } from '@/lib/ai';
import { applyOperations, contentHash, type FileMap } from '@/lib/project/files';
import { bundleHtml, testFiles } from '@/lib/project/bundle';
import { CODER_SYSTEM, PLANNER_SYSTEM, QUALITY_SYSTEM } from './prompts';
import { executePlan, jsonReply, outputSchema, reviewSchema, validatePlan, type RunRecord } from './contracts';

const ctxOf = (files: FileMap, paths: string[], cap = 40000) => {
  const out: { path: string; hash: string; content: string }[] = []; let size = 0;
  for (const path of paths) { const content = files[path]; if (content === undefined) continue; size += content.length; if (size > cap) break; out.push({ path, hash: contentHash(content), content }); }
  return out;
};

/** Planner → parallel coders → quality agent (fix loop) → test agent → build agent. */
export async function buildWithAgents(goal: string, files: FileMap, signal: AbortSignal, changed: (run: RunRecord) => void, token: (value: string) => void): Promise<{ files: FileMap; html: string }> {
  let run: RunRecord = { id: crypto.randomUUID(), createdAt: Date.now(), goal, state: 'planning', summary: 'পরিকল্পনা এজেন্ট কাজ ভাগ করছে', tasks: [], logs: [] };
  const notify = () => changed(structuredClone(run));
  const log = (m: string) => { run.logs.push(m); notify(); };
  const provider = (who: string) => (label: string) => log(`${who} → ${label}`);
  notify();
  try {
    let planText = '';
    const planText2 = await streamChat({ role: 'planner', onProvider: provider('পরিকল্পনা এজেন্ট'), system: PLANNER_SYSTEM, messages: [{ role: 'user', content: JSON.stringify({ goal, files: Object.keys(files) }) }], format: 'json', signal, onToken: t => { planText += t; token(planText); } });
    const plan = validatePlan(jsonReply(planText2));
    let candidate = { ...files };
    run = { ...run, state: 'running', summary: plan.summaryBn, tasks: plan.tasks.map(task => ({ ...task, state: 'queued' })) };
    log(`${plan.tasks.length}টি সাব-এজেন্ট তৈরি হয়েছে; একসাথে প্যারালালে চলবে।`);
    await executePlan(plan, signal, async task => {
      const context = ctxOf(candidate, [...new Set([...task.readPaths, ...task.writePaths])]);
      const reply = await streamChat({ role: 'coder', onProvider: provider(task.id), system: CODER_SYSTEM, messages: [{ role: 'user', content: JSON.stringify({ goal, task, fileList: Object.keys(candidate), context }) }], signal, format: 'json', onToken: () => {} });
      const result = outputSchema.parse(jsonReply(reply));
      const ops = result.operations.filter(op => op.op !== 'delete').map(op => op.op === 'update' && candidate[op.path] === undefined ? { op: 'create' as const, path: op.path, content: op.content } : op.op === 'update' ? { ...op, expectedHash: contentHash(candidate[op.path] ?? '') } : op.op === 'create' && candidate[op.path] !== undefined ? { op: 'update' as const, path: op.path, expectedHash: contentHash(candidate[op.path] ?? ''), content: op.content } : op);
      candidate = applyOperations(candidate, ops, task.writePaths);
      log(`${task.id}: ${result.summaryBn}`);
    }, (id, state) => { run.tasks = run.tasks.map(task => task.id === id ? { ...task, state } : task); notify(); });

    // Quality + test loop: up to 2 repair rounds.
    for (let round = 1; round <= 2; round++) {
      run.state = 'reviewing'; run.summary = `মান যাচাই এজেন্ট (রাউন্ড ${round})`; notify();
      const problems = testFiles(candidate);
      const reply = await streamChat({ role: 'quality', onProvider: provider('মান যাচাই এজেন্ট'), system: QUALITY_SYSTEM, messages: [{ role: 'user', content: JSON.stringify({ goal, testProblems: problems, fileList: Object.keys(candidate), context: ctxOf(candidate, Object.keys(candidate), 50000) }) }], signal, format: 'json', onToken: () => {} });
      const review = reviewSchema.parse(jsonReply(reply));
      log(`মান যাচাই: ${review.summaryBn}${review.issues.length ? ' — ' + review.issues.join('; ') : ''}`);
      const ops = review.operations.filter(op => op.op !== 'delete').map(op => candidate[op.path] === undefined ? { op: 'create' as const, path: op.path, content: 'content' in op ? op.content : '' } : { op: 'update' as const, path: op.path, expectedHash: contentHash(candidate[op.path] ?? ''), content: 'content' in op ? op.content : '' });
      if (ops.length) { candidate = applyOperations(candidate, ops); log(`মান যাচাই এজেন্ট ${ops.length}টি ফাইল ঠিক করেছে।`); }
      if (review.pass && !ops.length && !problems.length) break;
    }
    const remaining = testFiles(candidate);
    log(remaining.length ? `টেস্ট এজেন্ট: ${remaining.length}টি সমস্যা বাকি — ${remaining.join('; ')}` : 'টেস্ট এজেন্ট: সব স্ট্যাটিক পরীক্ষা পাস।');
    const html = bundleHtml(candidate);
    if (!html) throw new Error('বিল্ড এজেন্ট: index.html পাওয়া যায়নি।');
    log('বিল্ড এজেন্ট: সব ফাইল একত্র করে প্রিভিউ তৈরি হয়েছে।');
    run.state = 'completed'; run.summary = plan.summaryBn; notify();
    return { files: candidate, html };
  } catch (error) {
    run.state = signal.aborted ? 'cancelled' : 'failed';
    log(error instanceof Error ? error.message : 'কাজ ব্যর্থ হয়েছে।'); throw error;
  }
}

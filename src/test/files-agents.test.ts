import { beforeEach, describe, expect, it } from 'vitest';
import { applyOperations, contentHash, validPath, validateFiles } from '@/lib/project/files';
import { createProject, editProjectFiles, getProject, migrateProject, restoreRevision, saveProjectFiles, updateProject } from '@/lib/store';
import { executePlan, TEXT_MODELS, validatePlan } from '@/lib/agents/contracts';
import { nextTemplate } from '@/lib/project/template';
import { sourceZip } from '@/lib/project/export';
import { unzipSync, strFromU8 } from 'fflate';
const task = (id: string, dependsOn: string[] = []) => ({ id, role: 'builder', objective: 'Build module', dependsOn, readPaths: [], writePaths: [`components/${id}.tsx`], acceptanceChecks: ['Module exports component'] });
beforeEach(() => localStorage.clear());
describe('file operations', () => {
  it('migrates legacy HTML idempotently without losing messages', () => {
    const p = createProject('owner', 'legacy');
    const updated = updateProject(p.id, { html: '<html>legacy</html>', messages: [{ role: 'user', content: 'request' }] });
    if (!updated) throw new Error('missing project');
    const migrated = migrateProject(updated);
    expect(migrated.files).toEqual({ 'index.html': '<html>legacy</html>' });
    expect(migrateProject(migrated)).toEqual(migrated);
    expect(migrated.messages[0]?.content).toBe('request');
  });
  it('rejects secret, traversal, repository and generated paths', () => {
    for (const path of ['../x', '/x', 'a\\x', '.env', 'a/.env.local', '.git/config', 'node_modules/x', 'a//x', '%2e%2e/x']) expect(validPath(path)).toBe(false);
    expect(validPath('app/[id]/page.tsx')).toBe(true);
  });
  it('applies CRUD and rejects stale hashes atomically', () => {
    const files = { 'a.ts': 'one' };
    expect(applyOperations(files, [{ op: 'update', path: 'a.ts', expectedHash: contentHash('one'), content: 'two' }])).toEqual({ 'a.ts': 'two' });
    expect(() => applyOperations(files, [{ op: 'create', path: 'b.ts', content: 'new' }, { op: 'update', path: 'a.ts', expectedHash: 'wrong', content: 'two' }])).toThrow();
    expect(files).toEqual({ 'a.ts': 'one' });
    expect(() => applyOperations(files, [{ op: 'create', path: 'c.ts', content: 'new' }], ['b.ts'])).toThrow();
  });
  it('saves, renames, deletes and restores a file revision', () => {
    const p = createProject('owner', 'files');
    const initial = saveProjectFiles(p.id, { 'a.ts': 'one' }, 'initial', 'next');
    const revision = initial.revisions?.[0]; if (!revision) throw new Error('missing revision');
    editProjectFiles(p.id, [{ op: 'create', path: 'b.ts', content: 'one' }, { op: 'delete', path: 'a.ts', expectedHash: contentHash('one') }]);
    expect(getProject(p.id)?.files).toEqual({ 'b.ts': 'one' });
    restoreRevision(p.id, revision.id);
    expect(getProject(p.id)?.files).toEqual({ 'a.ts': 'one' });
  });
  it('bounds source volume and includes a reproducible Next template in ZIP', () => {
    expect(() => validateFiles({ 'a.txt': 'x'.repeat(2_000_001) })).toThrow();
    const files = nextTemplate(), zip = unzipSync(sourceZip(files));
    expect(Object.keys(zip)).toContain('package-lock.json');
    expect(strFromU8(zip['app/page.tsx'] ?? new Uint8Array())).toContain('Counter');
    const manifest = JSON.parse(files['package.json'] ?? '{}'), lock = JSON.parse(files['package-lock.json'] ?? '{}');
    expect(lock.packages[''].dependencies).toEqual(manifest.dependencies);
    expect(manifest.dependencies.next).toBe('16.4.3');
  });
});
describe('agent orchestration', () => {
  it('uses only the two user-selected models', () => { expect(TEXT_MODELS).toEqual({ coder: 'qwen2.5-coder:14b', planner: 'qwen2.5:14b' }); });
  it('rejects duplicate IDs, absent dependencies and cycles', () => {
    expect(() => validatePlan({ summaryBn: 'plan', tasks: [task('a'), task('a')] })).toThrow();
    expect(() => validatePlan({ summaryBn: 'plan', tasks: [task('a', ['missing'])] })).toThrow();
    expect(() => validatePlan({ summaryBn: 'plan', tasks: [task('a', ['b']), task('b', ['a'])] })).toThrow();
  });
  it('runs dependency-ready tasks once with concurrency one', async () => {
    const plan = validatePlan({ summaryBn: 'plan', tasks: [task('b', ['a']), task('a'), task('c')] });
    let active = 0, maximum = 0; const order: string[] = [];
    await executePlan(plan, new AbortController().signal, async t => { active++; maximum = Math.max(active, maximum); await Promise.resolve(); order.push(t.id); active--; }, () => {});
    expect(order).toEqual(['a', 'b', 'c']); expect(maximum).toBe(1);
  });
  it('does not run dependents after failure or explicit stop', async () => {
    const plan = validatePlan({ summaryBn: 'plan', tasks: [task('a'), task('b', ['a'])] }); const order: string[] = [];
    await expect(executePlan(plan, new AbortController().signal, async t => { order.push(t.id); throw new Error('failure'); }, () => {})).rejects.toThrow('failure');
    expect(order).toEqual(['a']);
    const ctrl = new AbortController(); ctrl.abort();
    await expect(executePlan(plan, ctrl.signal, async () => { order.push('unexpected'); }, () => {})).rejects.toThrow('Stopped');
    expect(order).toEqual(['a']);
  });
});

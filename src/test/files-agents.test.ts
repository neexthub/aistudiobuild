import { beforeEach, describe, expect, it } from 'vitest';
import { applyOperations, contentHash, validPath, validateFiles } from '@/lib/project/files';
import { createProject, editProjectFiles, getProject, migrateProject, restoreRevision, saveProjectFiles, updateProject } from '@/lib/store';
import { executePlan, AGENT_ROLES, validatePlan } from '@/lib/agents/contracts';
import { htmlTemplate } from '@/lib/project/template';
import { bundleHtml, testFiles } from '@/lib/project/bundle';
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
  it('bounds source volume and ships a multi-page HTML template in ZIP', () => {
    expect(() => validateFiles({ 'a.txt': 'x'.repeat(2_000_001) })).toThrow();
    const files = htmlTemplate(), zip = unzipSync(sourceZip(files));
    expect(Object.keys(zip)).toEqual(expect.arrayContaining(['index.html', 'about.html', 'css/style.css', 'js/app.js']));
    expect(testFiles(files)).toEqual([]);
    const html = bundleHtml(files)!;
    expect(html).toContain('__nbPages');
    expect(html).not.toContain('href="css/style.css"');
  });
  it('flags missing linked pages', () => {
    expect(testFiles({ 'index.html': '<html><a href="x.html">x</a></html>' })).toContain('index.html: x.html ফাইল নেই');
  });
});
describe('agent orchestration', () => {
  it('has planner, coder, quality, test, build and publish agents', () => { expect(AGENT_ROLES).toEqual(['planner', 'coder', 'quality', 'test', 'build', 'publish']); });
  it('rejects duplicate IDs and cycles; drops absent dependencies and tasks without files', () => {
    expect(() => validatePlan({ summaryBn: 'plan', tasks: [task('a'), task('a')] })).toThrow();
    expect(validatePlan({ summaryBn: 'plan', tasks: [task('a', ['missing'])] }).tasks[0]!.dependsOn).toEqual([]);
    expect(validatePlan({ summaryBn: 'plan', tasks: [task('a'), { id: 'x', role: 'r', objective: 'o' }] }).tasks.map(t => t.id)).toEqual(['a']);
    expect(() => validatePlan({ summaryBn: 'plan', tasks: [task('a', ['b']), task('b', ['a'])] })).toThrow();
  });
  it('runs independent tasks in parallel and dependents after', async () => {
    const plan = validatePlan({ summaryBn: 'plan', tasks: [task('b', ['a']), task('a'), task('c')] });
    let active = 0, maximum = 0; const order: string[] = [];
    await executePlan(plan, new AbortController().signal, async t => { active++; maximum = Math.max(active, maximum); await Promise.resolve(); order.push(t.id); active--; }, () => {});
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b')); expect(order).toHaveLength(3); expect(maximum).toBe(2);
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

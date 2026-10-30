import { describe, it, expect } from 'vitest';
import { bundleHtml, testFiles, isNextProject, resolveImport } from '@/lib/project/bundle';

const next = {
  'package.json': '{"name":"x"}',
  'app/layout.tsx': "export default function L({children}:{children:React.ReactNode}){return <html><body>{children}</body></html>}",
  'app/page.tsx': "'use client'\nimport { useState } from 'react';\nimport Card from '@/components/Card';\nexport default function P(){const [n,s]=useState(0);return <Card n={n} onClick={()=>s(n+1)} />}",
  'components/Card.tsx': "'use client'\nexport default function Card({n,onClick}:{n:number;onClick:()=>void}){return <button onClick={onClick}>{n}</button>}",
};
describe('Next.js preview', () => {
  it('detects Next projects and builds a runnable preview', () => { expect(isNextProject(next)).toBe(true); const h = bundleHtml(next)!; expect(h).toContain('babel'); expect(h).toContain('components/Card.tsx'); });
  it('passes static checks for a valid project', () => { expect(testFiles(next)).toEqual([]); });
  it('reports missing imports', () => { expect(testFiles({ ...next, 'app/page.tsx': "import X from './nope';\nexport default function P(){return <X/>}" }).join()).toContain('./nope'); });
  it('resolves @/ alias', () => { expect(resolveImport(next, 'app/page.tsx', '@/components/Card')).toBe('components/Card.tsx'); });
});

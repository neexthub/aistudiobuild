import type { FileMap } from './files';
import packageLock from '@/assets/next-template-lock.json';
export function nextTemplate(): FileMap {
  return {
    'package-lock.json': JSON.stringify(packageLock, null, 2),
    'package.json': JSON.stringify({ name: 'nextbuild-app', version: '1.0.0', private: true, scripts: { dev: 'next dev', build: 'next build', start: 'next start', typecheck: 'tsc --noEmit', test: 'node --test tests/*.test.mjs' }, dependencies: { next: '16.4.3', react: '19.2.0', 'react-dom': '19.2.0' }, devDependencies: { typescript: '5.8.3', '@types/node': '22.16.5', '@types/react': '19.2.0', '@types/react-dom': '19.2.0', tailwindcss: '4.2.1', '@tailwindcss/postcss': '4.2.1' } }, null, 2),
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2020', lib: ['dom', 'dom.iterable', 'esnext'], strict: true, noEmit: true, esModuleInterop: true, module: 'esnext', moduleResolution: 'bundler', resolveJsonModule: true, isolatedModules: true, jsx: 'react-jsx', plugins: [{ name: 'next' }], paths: { '@/*': ['./*'] } }, include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'], exclude: ['node_modules'] }, null, 2),
    'next-env.d.ts': '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
    'next.config.ts': 'import type { NextConfig } from "next";\nconst config: NextConfig = { output: "export", trailingSlash: true, images: { unoptimized: true } };\nexport default config;\n',
    'postcss.config.mjs': 'export default { plugins: { "@tailwindcss/postcss": {} } };\n',
    'app/layout.tsx': 'import "./globals.css";\nimport type { ReactNode } from "react";\nexport const metadata = { title: "NextBuild App", description: "বাংলায় তৈরি অ্যাপ" };\nexport default function RootLayout({ children }: { children: ReactNode }) { return <html lang="bn"><body>{children}</body></html>; }\n',
    'app/page.tsx': 'import Counter from "@/components/Counter";\nexport default function Page() { return <main><h1>আমার নতুন অ্যাপ</h1><Counter /></main>; }\n',
    'app/globals.css': '@import "tailwindcss";\n:root { --background: #14181b; --foreground: #f0f5f3; --primary: #65dfad; }\nbody { margin: 0; background: var(--background); color: var(--foreground); font-family: system-ui, sans-serif; }\nmain { max-width: 960px; margin: auto; padding: 48px 24px; }\nbutton { border: 0; border-radius: 6px; padding: 12px 20px; background: var(--primary); color: var(--background); cursor: pointer; }\n',
    'components/Counter.tsx': '"use client";\nimport { useState } from "react";\nimport { increment } from "@/lib/counter.mjs";\nexport default function Counter() { const [count, setCount] = useState(0); return <button onClick={() => setCount(increment(count))}>গণনা: {count}</button>; }\n',
    'lib/counter.mjs': 'export function increment(value) { return value + 1; }\n',
    'lib/counter.d.mts': 'export function increment(value: number): number;\n',
    'tests/counter.test.mjs': 'import { test } from "node:test";\nimport assert from "node:assert/strict";\nimport { increment } from "../lib/counter.mjs";\ntest("increments count", () => { assert.equal(increment(2), 3); });\n',
    '.gitignore': 'node_modules/\n.next/\nout/\n.env*\n',
    'README.md': '# NextBuild App\n\nNode.js 22+ required. Run npm ci, npm test, npm run typecheck, npm run build.\nStatic output is in out/. For subpath publishing set basePath before building.\nNever store secrets in source.\n',
  };
}

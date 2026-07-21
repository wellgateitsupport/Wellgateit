#!/usr/bin/env node
// bundle binSync.js (+ dependencies ที่มี JSX เช่น core.jsx) ให้ node:test import ได้
// — node ไม่รู้จัก JSX; esbuild (มากับ Vite อยู่แล้ว) transform ให้ + inject browser shims
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [path.join(ROOT, 'src/cloud/binSync.js')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: path.join(ROOT, 'tests/unit/.build/binSync.bundle.mjs'),
  jsx: 'automatic',
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  inject: [path.join(ROOT, 'scripts/test-shims.js')],
  logLevel: 'warning',
});
console.log('✓ tests/unit/.build/binSync.bundle.mjs');

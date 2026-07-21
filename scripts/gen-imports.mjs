#!/usr/bin/env node
/**
 * gen-imports.mjs — เติม import ให้โมดูลที่สกัดมา แบบ fixpoint loop
 *
 * หลักการ: โค้ดเดิมอยู่ใน global scope เดียวกัน (ไม่มี import/export)
 * หลังแยกโมดูล ตัวแปรข้าม block จะโดน ESLint no-undef / react/jsx-no-undef
 * สคริปต์นี้รัน ESLint → จับ identifier ที่ขาด → เติม import จาก symbol table
 * → วนจนเหลือ 0 (converge เร็วเพราะ import graph เป็น acyclic)
 *
 * identifier ที่ไม่รู้จัก (ไม่อยู่ใน table) = hard error ให้คนตรวจ — ห้ามเดา
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MANIFEST, HDR_START, HDR_END } from './extract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_PASSES = 6;

// ── สร้าง symbol table จากบรรทัด export ของทุกโมดูล ──
const buildSymbolTable = () => {
  const table = new Map(); // name -> module file (relative to ROOT)
  for (const entry of MANIFEST) {
    if (entry.kind === 'css') continue;
    const content = fs.readFileSync(path.join(ROOT, entry.file), 'utf8');
    const m = content.match(/^export \{ (.+) \};$/m);
    if (!m) throw new Error(`${entry.file}: export line not found — run extract.mjs first`);
    for (const name of m[1].split(',').map(s => s.trim()).filter(Boolean)) {
      if (table.has(name)) throw new Error(`duplicate symbol "${name}" in ${table.get(name)} and ${entry.file}`);
      table.set(name, entry.file);
    }
  }
  return table;
};

// ── รัน ESLint แล้วเก็บ undefined identifiers ต่อไฟล์ ──
const runEslint = () => {
  const res = spawnSync('npx', ['eslint', '--format', 'json', 'src'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024,
  });
  if (!res.stdout) {
    throw new Error(`eslint produced no output (status ${res.status}): ${res.stderr?.slice(0, 2000)}`);
  }
  const report = JSON.parse(res.stdout);
  const perFile = new Map(); // rel file -> Set(identifiers)
  let total = 0;
  for (const fileReport of report) {
    const rel = path.relative(ROOT, fileReport.filePath).split(path.sep).join('/');
    for (const msg of fileReport.messages) {
      if (msg.ruleId !== 'no-undef' && msg.ruleId !== 'react/jsx-no-undef') continue;
      const im = /'([^']+)'/.exec(msg.message);
      if (!im) continue;
      if (!perFile.has(rel)) perFile.set(rel, new Set());
      perFile.get(rel).add(im[1]);
      total++;
    }
  }
  return { perFile, total };
};

const relImportPath = (fromFile, toFile) => {
  let rel = path.relative(path.dirname(fromFile), toFile).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
};

// ── อ่าน/เขียน header region ของโมดูล ──
const readHeader = (content, file) => {
  if (!content.startsWith(HDR_START + '\n')) throw new Error(`${file}: missing header start marker`);
  const end = content.indexOf('\n' + HDR_END + '\n');
  if (end === -1) throw new Error(`${file}: missing header end marker`);
  return {
    lines: content.slice(HDR_START.length + 1, end).split('\n').filter(l => l.trim() !== ''),
    rest: content.slice(end + HDR_END.length + 2),
  };
};

const parseImportLine = (line) => {
  let m = /^import \{ (.+) \} from '(.+)';$/.exec(line);
  if (m) return { names: m[1].split(',').map(s => s.trim()), from: m[2], default: null };
  m = /^import (\w+) from '(.+)';$/.exec(line);
  if (m) return { names: [], from: m[2], default: m[1] };
  throw new Error(`unrecognized import line: ${line}`);
};

const addImports = (file, needed, table) => {
  const abs = path.join(ROOT, file);
  const content = fs.readFileSync(abs, 'utf8');
  const { lines, rest } = readHeader(content, file);

  // รวม import เดิม + ที่ต้องเติมใหม่
  const byPath = new Map(); // from -> { default, names:Set }
  for (const line of lines) {
    const p = parseImportLine(line);
    if (!byPath.has(p.from)) byPath.set(p.from, { default: null, names: new Set() });
    const slot = byPath.get(p.from);
    if (p.default) slot.default = p.default;
    for (const n of p.names) slot.names.add(n);
  }
  for (const name of needed) {
    const provider = table.get(name);
    if (provider === file) continue; // ประกาศในไฟล์ตัวเอง — ไม่ต้อง import (ไม่ควรเกิด)
    const from = relImportPath(file, provider);
    if (!byPath.has(from)) byPath.set(from, { default: null, names: new Set() });
    byPath.get(from).names.add(name);
  }

  // เรียงลำดับ deterministic: react ก่อน แล้วเรียงตาม path
  const ordered = [...byPath.entries()].sort(([a], [b]) => {
    const ra = a === 'react' ? 0 : 1, rb = b === 'react' ? 0 : 1;
    return ra - rb || a.localeCompare(b);
  });
  const newLines = ordered.map(([from, slot]) => {
    const parts = [];
    if (slot.default) parts.push(slot.default);
    if (slot.names.size) parts.push(`{ ${[...slot.names].sort().join(', ')} }`);
    return `import ${parts.join(', ')} from '${from}';`;
  });

  fs.writeFileSync(abs, [HDR_START, ...newLines, HDR_END, rest].join('\n'));
};

// ── main fixpoint loop ──
const table = buildSymbolTable();
console.log(`symbol table: ${table.size} names across ${MANIFEST.filter(e => e.kind !== 'css').length} modules`);

for (let pass = 1; pass <= MAX_PASSES; pass++) {
  const { perFile, total } = runEslint();
  if (total === 0) {
    console.log(`\npass ${pass}: 0 undefined identifiers — converged ✔`);
    process.exit(0);
  }
  console.log(`\npass ${pass}: ${total} undefined identifier reports in ${perFile.size} file(s)`);

  const unknowns = [];
  for (const [file, names] of perFile) {
    const resolvable = [...names].filter(n => table.has(n));
    for (const n of names) if (!table.has(n)) unknowns.push({ file, name: n });
    if (resolvable.length) {
      addImports(file, resolvable, table);
      console.log(`  ${file}: +${resolvable.length} imports`);
    }
  }
  if (unknowns.length) {
    console.error('\n✗ UNKNOWN identifiers (ไม่อยู่ใน symbol table — ต้องตรวจด้วยมือ):');
    for (const u of unknowns) console.error(`    ${u.file}: ${u.name}`);
    process.exit(1);
  }
}
console.error(`\n✗ did not converge within ${MAX_PASSES} passes`);
process.exit(1);

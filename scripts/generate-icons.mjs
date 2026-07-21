#!/usr/bin/env node
// สร้าง PWA icons จาก SVG (path-only — ไม่มี <text> เพื่อเลี่ยงปัญหา font rasterization)
// ผลลัพธ์ commit ลง repo แล้ว — CI ไม่ต้องรันสคริปต์นี้ (sharp เป็น devDep ใช้ครั้งเดียว)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

const BRAND = '#E08A3F';   // ≈ oklch(70% 0.17 55) — สีแบรนด์ของแอพ
const BG = '#FAF7F2';

// โลโก้: แถบ flow 3 ระดับ + วงเช็คอนุมัติ (สื่อ "คำขอไหลผ่านการอนุมัติ")
const glyph = (fg, accent) => `
  <rect x="120" y="132" width="272" height="52" rx="26" fill="${fg}" opacity="0.97"/>
  <rect x="120" y="222" width="196" height="52" rx="26" fill="${fg}" opacity="0.78"/>
  <rect x="120" y="312" width="120" height="52" rx="26" fill="${fg}" opacity="0.58"/>
  <circle cx="344" cy="344" r="86" fill="${fg}"/>
  <path d="M306 344 l28 28 l50 -56" stroke="${accent}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

const svgStandard = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="${BRAND}"/>${glyph('#fff', BRAND)}
</svg>`;

// maskable: full-bleed + ย่อเนื้อหาให้อยู่ใน safe zone 80%
const svgMaskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BRAND}"/>
  <g transform="translate(51.2 51.2) scale(0.8)">${glyph('#fff', BRAND)}</g>
</svg>`;

const jobs = [
  { file: 'icon-192.png', svg: svgStandard, size: 192 },
  { file: 'icon-512.png', svg: svgStandard, size: 512 },
  { file: 'maskable-512.png', svg: svgMaskable, size: 512 },
];
for (const { file, svg, size } of jobs) {
  await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toFile(path.join(OUT, file));
  console.log(`✓ public/icons/${file}`);
}
fs.writeFileSync(path.join(OUT, 'favicon.svg'), svgStandard.trim() + '\n');
console.log('✓ public/icons/favicon.svg');

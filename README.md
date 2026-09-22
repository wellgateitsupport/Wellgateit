# FlowDesk — ระบบแจ้งงานและติดตามงาน

ระบบคำขอ-อนุมัติสำหรับทีมภายในองค์กร (ภาษาไทย): สร้างคำขอ 9 ประเภท (เบิกของ ยืม-คืน เบิกเงิน
อีเว้นท์ จัดซื้อ OT ใบลา ขอคน อนุมัติทั่วไป) → ไหลผ่านสายอนุมัติตามแผนก/ตำแหน่งที่ปรับแต่งได้ →
ติดตามสถานะ SLA เคลียร์เอกสาร สต๊อก audit log และรายงานผู้บริหาร ครบในแอพเดียว
รองรับ ~50 ผู้ใช้ 10 แผนก พร้อมระบบสิทธิ์ ลายเซ็น มอบอำนาจ (OOO) undo/redo และ dark mode

ใช้งานได้ 2 โหมด: **เครื่องเดียว** (ข้อมูลใน localStorage — เปิดใช้ได้เลยไม่ต้องตั้งค่า) และ
**โหมดทีม** (Firebase Realtime Database — ซิงค์ทุกเครื่องแบบ realtime, ฟรี) ติดตั้งเป็น PWA ได้

📖 **วิธีติดตั้งทีละขั้นตอน (ภาษาไทย): [SETUP.md](./SETUP.md)**

## Tech stack

- React 18.3.1 + Vite 7 (production build, code-splitting, sourcemaps)
- Firebase JS SDK v12 — Realtime Database + Anonymous Auth (โหมดทีม; เปิดผ่าน env ตอน build)
- vite-plugin-pwa (Workbox) — ติดตั้งบนมือถือ/เดสก์ท็อป ใช้ offline ได้
- Playwright (E2E smoke) + node:test (unit) + ESLint 9 (no-undef harness)
- GitHub Actions — CI ทุก push + deploy ขึ้น GitHub Pages อัตโนมัติเมื่อ merge เข้า `main`

## คำสั่ง

```bash
npm install            # ติดตั้ง dependencies
npm run dev            # dev server → http://localhost:5173
npm run build          # production build → dist/
npm run preview        # เสิร์ฟ dist/ ที่ :4173
npm run lint           # ESLint (จับ import/identifier ขาด)
npm run test:unit      # unit tests: merge/diff logic ของระบบซิงค์
npm test               # Playwright E2E (build ก่อน แล้ว preview อัตโนมัติ)
```

## โครงสร้างโปรเจกต์

```
original/index.html      ← ไฟล์ต้นฉบับ (แอพไฟล์เดียว 13,472 บรรทัด) — source of truth
scripts/extract.mjs      ← สกัด src/ จากต้นฉบับแบบ byte-identical + registry ของ patch ทุกจุด
scripts/gen-imports.mjs  ← เติม import ข้ามโมดูลอัตโนมัติ (ESLint fixpoint)
src/
  styles/global.css        สไตล์ทั้งหมด (รวม dark theme)
  data/mock.js             ข้อมูลตั้งต้น: แผนก ผู้ใช้ สินค้า + ตัวสร้างสายอนุมัติ
  lib/core.jsx             ส่วนกลาง: UI kit, SLA, สิทธิ์, ลายเซ็น, ฟอร์แมตวันที่ไทย
  pages/*.jsx              หน้าทั้งหมด (dashboard, คำขอ, สต๊อก, ทีมงาน, รายงาน, ตั้งค่า)
  shell/                   App state หลัก, sidebar/topbar, error boundary
  cloud/binSync.js         merge engine เดิม (updatedAt-wins) + legacy bin sync
  cloud/firebase.js        ขอบเขต Firebase SDK ทั้งหมด
  cloud/diff.js            baseline diff → per-record fanout (pure, มี unit test)
  cloud/useFirebaseSync.js realtime sync hook (inbound merge + outbound debounced push)
public/exam/             แอพทำข้อสอบการขาย บทที่ 4-8 (static ล้วน — ดู public/exam/README.md)
tests/                   Playwright smoke (ทุก route + สร้าง→อนุมัติ) + unit tests
.github/workflows/       ci.yml (ทุก push) + deploy.yml (Pages เมื่อ push main)
```

## 📝 แอพทำข้อสอบ 2 วิชา

นอกจาก FlowDesk แล้ว repo นี้ยังมีแอพทำข้อสอบแยกอีกตัวอยู่ที่ `public/exam/` —
สุ่มข้อสอบ 60 ข้อ (ปรนัย 40 ข้อ 5 ตัวเลือก · จับคู่คำลงช่องว่าง 10 · เติมคำ 10)
เฉลยทันทีทุกข้อ และเก็บคะแนนทุกรอบไว้ใน localStorage แยกตามวิชา

| วิชา | เนื้อหา | คลังข้อสอบ |
|------|---------|------------|
| เทคนิคการขายมืออาชีพ | บทที่ 4 – 8 | ปรนัย 259 · เติมคำ 58 · จับคู่ 19 ชุด |
| การจัดการการตลาดสมัยใหม่ | บทที่ 5 – 9 | ปรนัย 162 · เติมคำ 53 · จับคู่ 16 ชุด |

ข้อปรนัยมี 2 ลักษณะ คือ **ข้อความจำ** และ **ข้อวิเคราะห์** (ยกสถานการณ์จริงมาให้
แล้วถามว่าเข้าข่ายแนวคิดแบบใด — มี 113 ข้อจาก 421 ข้อ) เลือกสัดส่วนได้ในหน้าแรก
และหน้าสรุปผลจะแยกคะแนนความจำ/วิเคราะห์ให้เห็นว่าควรทบทวนด้านไหน

ผู้ใช้แก้ชื่อวิชา ชื่อย่อ และไอคอนได้เองในแอพ (เก็บใน localStorage คืนค่าเดิมได้)
และ UI ออกแบบให้รองรับวิชาเพิ่มขึ้นเรื่อย ๆ — รายการวิชาซ่อนอยู่หลังปุ่ม "เปลี่ยนวิชา"
มีช่องค้นหาอัตโนมัติเมื่อถึง 6 วิชา และตัวกรองประวัติเปลี่ยนเป็น dropdown เมื่อเกิน 4 วิชา
การเพิ่มวิชาใหม่แก้แค่ `data/00-subjects.js` + ไฟล์ข้อสอบ + script tag โดยไม่ต้องแตะ `app.js`

- ใช้งานผ่านเว็บ: `<เว็บที่ deploy>/exam/` หรือ `http://localhost:5173/exam/` ตอน dev
- หรือเปิดไฟล์ `public/exam/index.html` ตรง ๆ ก็ได้ ไม่ต้องรันเซิร์ฟเวอร์และไม่ต้องต่อเน็ต
- เป็น static HTML/CSS/JS ล้วน ไม่แตะโค้ด FlowDesk และไม่ต้อง build

รายละเอียดทั้งหมด (รวมวิธีเพิ่ม/แก้ข้อสอบ): **[public/exam/README.md](./public/exam/README.md)**

## ที่มาของโค้ด (provenance)

โปรเจกต์นี้แปลงมาจากแอพ React ไฟล์เดียว (`original/index.html` — CDN + Babel in-browser)
เป็นโปรเจกต์ Vite แบบหลายโมดูล **โดยไม่แก้พฤติกรรมเดิม**:

- `scripts/extract.mjs` ตัดโค้ดตามช่วงบรรทัดที่ประกาศไว้ → ทุกโมดูลตรวจย้อนได้ว่า
  **byte-identical กับต้นฉบับ** ยกเว้นจุดแก้ที่ลงทะเบียนใน `PATCHES` (7 จุด มีเหตุผลกำกับทุกจุด)
- ตรวจได้เอง: `node scripts/extract.mjs --verify`
- CI รันการตรวจนี้ทุก push

## โหมดการทำงาน

| | เครื่องเดียว (default) | ทีม (Firebase) |
|---|---|---|
| เปิดใช้เมื่อ | ไม่มี env `VITE_FIREBASE_*` | build พร้อม env/secrets ครบ (ดู SETUP.md) |
| ข้อมูล | localStorage ต่อเครื่อง | RTDB กลาง + localStorage เป็น offline cache |
| การซิงค์ | – (มี bin-sync แบบเดิมใน ตั้งค่า → Cloud Sync) | realtime ทุกเครื่อง, push เฉพาะ record ที่เปลี่ยน |
| ขัดแย้งกัน | – | merge อัตโนมัติ (updatedAt ใหม่กว่าชนะ — engine เดิมของแอพ) |

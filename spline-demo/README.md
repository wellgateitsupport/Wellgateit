# spline-demo — Interactive 3D (Spline + Spotlight)

โปรเจกต์สาธิตแยกต่างหากจากแอพหลัก FlowDesk — ตั้งค่าเป็น **Vite + React + TypeScript + Tailwind CSS + shadcn** ให้ถูกต้องตามที่คอมโพเนนต์ 3D Spline ต้องการ โดย**ไม่แตะโค้ด FlowDesk เดิม** (ที่เป็น JavaScript + CSS ธรรมดา)

## ทำไมต้องแยกโปรเจกต์

คอมโพเนนต์นี้ต้องใช้ TypeScript, Tailwind CSS และโครงสร้าง shadcn (`@/components/ui`, `@/lib/utils`) — ซึ่ง FlowDesk ไม่มี การเอา Tailwind ไปใส่ใน FlowDesk เสี่ยงทำให้ `global.css` เดิม (ระบบสี oklch) เพี้ยน จึงแยกเป็นพื้นที่สะอาดของตัวเอง

## รันในเครื่อง

```bash
cd spline-demo
npm install
npm run dev        # http://localhost:5173
npm run build      # tsc typecheck + vite build → dist/
npm run preview    # เสิร์ฟ build ที่ :4174
```

## โครงสร้าง (ตามมาตรฐาน shadcn)

```
components.json              config ของ shadcn CLI
tailwind.config.js           theme tokens (bg-card, border ฯลฯ)
src/index.css                @tailwind + ตัวแปรสี shadcn (light/dark) + .loader
src/lib/utils.ts             cn() — clsx + tailwind-merge
src/components/ui/
  splite.tsx                 SplineScene — โหลดฉาก 3D แบบ lazy + Suspense + Error boundary
  spotlight.tsx              Spotlight — วงแสงเรืองตามเมาส์ (framer-motion)
  card.tsx                   Card (shadcn)
  demo.tsx                   SplineSceneBasic — ตัวอย่างประกอบทั้งหมดเข้าด้วยกัน
src/App.tsx                  วาง <SplineSceneBasic/> กลางจอ
```

## ตำแหน่งที่วางไฟล์ (`/components/ui`)

shadcn กำหนดให้ primitive UI ทุกตัวอยู่ใน `src/components/ui` และอ้างถึงผ่าน alias `@/components/ui/*`
ต้องมีโฟลเดอร์นี้เพราะ (1) `components.json` ชี้ alias มาที่นี่ (2) shadcn CLI (`npx shadcn@latest add ...`)
จะติดตั้งคอมโพเนนต์ลงที่นี่โดยอัตโนมัติ (3) ทำให้ import สั้นและย้ายโปรเจกต์ได้โดยไม่ต้องแก้ path

## หมายเหตุการ integrate (ตอบคำถามมาตรฐาน)

- **props ที่รับ:** `SplineScene` รับ `scene` (URL ของไฟล์ `.splinecode`) และ `className` — ส่งมาจาก `demo.tsx` แล้ว
- **state:** `Spotlight` จัดการตำแหน่งเมาส์ภายในตัวเอง (`useSpring`/`useTransform`) ไม่ต้องมี state management ภายนอก
- **assets:** ไม่ต้องใช้รูป/ไอคอนเพิ่ม — ฉาก 3D โหลดจาก URL ของ Spline โดยตรง (ไม่มี `<img>` หรือ lucide icon ในคอมโพเนนต์)
- **responsive:** เลย์เอาต์เป็น 2 คอลัมน์ (`flex`) — ข้อความซ้าย + ฉาก 3D ขวา; ตำแหน่ง spotlight ปรับที่ breakpoint `md:`
- **จุดที่ปรับจากโค้ดต้นฉบับ 2 จุด (เสริมความทนทาน ไม่เปลี่ยน API):**
  1. `spotlight.tsx` เพิ่ม prop `fill?: string` (optional) เพราะ `demo.tsx` ส่ง `fill="white"` มา แต่ Spotlight เวอร์ชันนี้เป็นแบบ mouse-follow ไม่ได้ใช้ค่านั้น — เพิ่มไว้กัน TypeScript error
  2. `splite.tsx` ห่อ `<Spline>` ด้วย Error boundary — ถ้าฉาก 3D โหลดไม่ได้ (ออฟไลน์/URL ผิด/WebGL ไม่รองรับ) จะแสดง fallback แทนการทำให้ทั้งหน้าพัง

## dependencies ที่เพิ่ม

`@splinetool/react-spline`, `@splinetool/runtime`, `framer-motion` (คอมโพเนนต์),
`clsx`, `tailwind-merge`, `class-variance-authority`, `tailwindcss-animate`, `lucide-react` (มาตรฐาน shadcn)

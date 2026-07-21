# คู่มือติดตั้ง FlowDesk — ระบบแจ้งงานและติดตามงาน

คู่มือนี้พาตั้งค่าระบบตั้งแต่ศูนย์จนทีมใช้งานร่วมกันได้จริง **ทุกอย่างฟรี ไม่ต้องใช้บัตรเครดิต**
ใช้เวลาประมาณ 15–20 นาที

---

## ภาพรวม: ระบบทำงานได้ 2 โหมด

| | โหมดเครื่องเดียว (localStorage) | โหมดทีม (Firebase) ⭐ แนะนำ |
|---|---|---|
| ข้อมูลเก็บที่ | ในเบราว์เซอร์ของแต่ละเครื่อง | ฐานข้อมูลกลางบน cloud + สำรองในเครื่อง |
| ซิงค์ข้ามเครื่อง | ไม่ซิงค์ | ✅ ทันที (realtime) ทุกเครื่อง |
| ใช้ offline | ✅ | ✅ (ซิงค์กลับเมื่อออนไลน์) |
| ต้องตั้งค่าอะไร | ไม่ต้อง — เปิดเว็บใช้ได้เลย | สมัคร Firebase ครั้งเดียว (หัวข้อถัดไป) |

> ถ้ายังไม่ตั้งค่า Firebase ระบบจะทำงานโหมดเครื่องเดียวอัตโนมัติ — ตั้งค่าทีหลังได้เสมอ
> ข้อมูลที่มีอยู่ในเครื่องจะถูกอัปโหลดขึ้น cloud ให้อัตโนมัติในครั้งแรกที่เชื่อมต่อ

**สิ่งที่ต้องมี:** บัญชี Gmail 1 บัญชี (สำหรับ Firebase) + บัญชี GitHub ที่เป็นเจ้าของ repo นี้

---

## ส่วนที่ 1 — สร้างโปรเจกต์ Firebase (ครั้งเดียว)

### 1.1 สร้างโปรเจกต์

1. เปิด <https://console.firebase.google.com> แล้วลงชื่อเข้าด้วย Gmail
2. กด **Create a project** (สร้างโปรเจกต์)
3. ตั้งชื่อ เช่น `flowdesk-wellgate` → กด Continue
4. หน้า Google Analytics: **ปิด** (ไม่จำเป็น) → กด Create project → รอสักครู่ → Continue

### 1.2 เปิดระบบล็อกอินแบบ Anonymous

1. เมนูซ้าย: **Build → Authentication** → กด **Get started**
2. แท็บ **Sign-in method** → เลือก **Anonymous** → เปิดสวิตช์ **Enable** → Save

> ระบบใช้ anonymous auth เพื่อให้กฎความปลอดภัยของฐานข้อมูลบังคับว่า "ต้องเข้าผ่านแอพเท่านั้น"
> ส่วนการล็อกอินเลือกชื่อ/รหัสผ่านของพนักงานเป็นระบบภายในแอพเหมือนเดิม

### 1.3 สร้าง Realtime Database

1. เมนูซ้าย: **Build → Realtime Database** → กด **Create Database**
2. เลือก location: **Singapore (asia-southeast1)** (ใกล้ไทยที่สุด) → Next
3. เลือก **Start in locked mode** → Enable
4. เข้าแท็บ **Rules** แล้ววางกฎนี้ทับของเดิมทั้งหมด → กด **Publish**

```json
{
  "rules": {
    ".read": false,
    ".write": false,
    "flowdesk": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

### 1.4 ลงทะเบียนเว็บแอพ + คัดลอกค่า config

1. กดไอคอนฟันเฟือง (มุมซ้ายบน) → **Project settings**
2. เลื่อนลงหา **Your apps** → กดไอคอน **`</>`** (Web)
3. ตั้งชื่อ เช่น `flowdesk-web` → **ไม่ต้อง**ติ๊ก Firebase Hosting → กด Register app
4. จะเห็นโค้ด `firebaseConfig` — **คัดลอกค่า 5 ตัวนี้เก็บไว้** (ใช้ในส่วนที่ 2):

| ค่าใน firebaseConfig | จะไปใส่ใน Secret ชื่อ |
|---|---|
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `databaseURL` | `VITE_FIREBASE_DATABASE_URL` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` |
| `appId` | `VITE_FIREBASE_APP_ID` |

> ⚠️ ถ้าไม่เห็น `databaseURL` ในโค้ด: กลับไปหน้า Realtime Database — URL อยู่ด้านบนของหน้า
> รูปแบบ `https://ชื่อโปรเจกต์-default-rtdb.asia-southeast1.firebasedatabase.app`

---

## ส่วนที่ 2 — ตั้งค่า GitHub (Secrets + Pages)

### 2.1 ใส่ Secrets 5 ตัว

1. เปิด repo บน GitHub → **Settings → Secrets and variables → Actions**
2. กด **New repository secret** แล้วเพิ่มทีละตัวจนครบ 5 ตัวตามตารางข้างบน
   (ชื่อ secret ต้องพิมพ์ตรงเป๊ะ ตัวใหญ่ทั้งหมด · ค่า = ค่าจาก firebaseConfig ไม่ต้องมีเครื่องหมายคำพูด)

### 2.2 เปิด GitHub Pages

1. **Settings → Pages**
2. หัวข้อ **Build and deployment → Source** เลือก **GitHub Actions**

### 2.3 Deploy

- merge branch นี้เข้า `main` (หรือ push อะไรก็ได้เข้า `main`) → ระบบ build + deploy อัตโนมัติ
- ตามดูได้ที่แท็บ **Actions** → workflow "Deploy to GitHub Pages" (ประมาณ 2–3 นาที)
- เสร็จแล้วเว็บอยู่ที่: **`https://<ชื่อผู้ใช้ github>.github.io/Wellgateit/`**
- อยาก deploy ซ้ำโดยไม่ push: แท็บ Actions → เลือก workflow → **Run workflow**

> 💡 ถ้าข้าม Secrets (ส่วน 2.1) เว็บจะ deploy ได้เหมือนกัน แต่เป็นโหมดเครื่องเดียว (ไม่ซิงค์)

---

## ส่วนที่ 3 — เริ่มใช้งานครั้งแรก

1. **ผู้ดูแลเปิดเว็บเป็นคนแรก** — ถ้าเคยใช้เวอร์ชันไฟล์เดียวมาก่อนในเครื่องนี้
   ข้อมูลเดิมทั้งหมด (คำขอ พนักงาน สินค้า) จะถูกอัปโหลดขึ้น cloud อัตโนมัติ
2. ล็อกอินด้วยผู้ใช้ผู้ดูแล (ค่าเริ่มต้นของระบบคือ **ACC-004 คุณสมหญิง**)
   — ผู้ใช้ตั้งต้นยังไม่มีรหัสผ่าน กดเข้าได้เลย
3. ไปที่ **ตั้งค่า → ทีมงาน** เพื่อ เพิ่ม/แก้ไข รายชื่อพนักงานจริง และ**ตั้งรหัสผ่าน**ให้แต่ละคน
4. แจก URL ให้ทีม — ทุกคนเปิดเว็บ เลือกชื่อตัวเอง ใส่รหัส แล้วใช้งานได้ทันที
   ข้อมูลจะเห็นตรงกันทุกเครื่องแบบ realtime
5. ตรวจสถานะซิงค์ได้ที่ **ตั้งค่า → Cloud Sync** (จุดเขียว = เชื่อมต่อแล้ว)
6. (มือถือ) เปิดเว็บใน Chrome/Safari → เมนู → **เพิ่มไปยังหน้าจอหลัก** — ได้แอพ PWA ไอคอนส้ม

---

## สำหรับนักพัฒนา — รันในเครื่อง

```bash
npm install
cp .env.example .env       # เติมค่า VITE_FIREBASE_* ถ้าต้องการทดสอบโหมดทีม (เว้นว่าง = โหมดเครื่องเดียว)
npm run dev                # เปิด http://localhost:5173

npm run lint               # ตรวจ import/identifier ทั้งหมด
npm run build              # build production ลง dist/
npm run test:unit          # unit tests (merge/diff logic ของระบบซิงค์)
npm test                   # Playwright E2E (ต้อง build ก่อน)
node scripts/extract.mjs --verify   # พิสูจน์ว่าโค้ดตรงกับไฟล์ต้นฉบับ (ดู README)
```

ทดสอบ Firebase โดยไม่ใช้โปรเจกต์จริง: ติดตั้ง [firebase-tools](https://firebase.google.com/docs/emulator-suite)
แล้วรัน `firebase emulators:start --only auth,database` + ใส่ `VITE_FIREBASE_EMULATOR=1` ใน `.env`

---

## คำถามพบบ่อย

**ฟรีจริงไหม? มีลิมิตเท่าไหร่?**
Firebase Spark plan (ฟรีถาวร): เชื่อมต่อพร้อมกัน 100 เครื่อง · เก็บข้อมูล 1 GB · ดาวน์โหลด 10 GB/เดือน
— ทีม ~50 คนใช้สบายมาก ระบบถูกออกแบบให้ส่งเฉพาะข้อมูลที่เปลี่ยน (per-record) เพื่อประหยัดโควต้า
GitHub Pages ฟรีสำหรับ public repo (private ต้องมี GitHub Pro/ทีม)

**ปลอดภัยแค่ไหน? apiKey อยู่ในโค้ดเว็บไม่อันตรายเหรอ?**
`apiKey` ของ Firebase เป็นค่าสาธารณะโดยการออกแบบ (ระบุโปรเจกต์ ไม่ใช่รหัสลับ) — การป้องกันจริงอยู่ที่ Rules
กฎที่ตั้งไว้เปิดให้เฉพาะคนที่เข้าผ่านแอพ (anonymous auth) อ่าน/เขียนได้ ระดับความเชื่อถือเทียบเท่า
"ทุกคนที่มี URL เว็บ" — เหมาะกับระบบภายในทีม ถ้าต้องการเข้มขึ้นในอนาคต อัปเกรดเป็น
email/password auth + rules ตรวจ uid ได้โดยไม่ต้องแก้โครงสร้างข้อมูล

**อยากลบข้อมูลทั้งหมดเริ่มใหม่?**
Firebase console → Realtime Database → Data → ลบ node `flowdesk` (กดถังขยะ) แล้วให้ทุกเครื่อง
ตั้งค่า → ทั่วไป → **Factory reset** (ถ้าลบเฉพาะฝั่ง cloud เครื่องที่ยังมีข้อมูลเก่าจะอัปโหลดกลับขึ้นไปใหม่)

**Backup ยังใช้ได้ไหม?**
ได้ — ตั้งค่า → ทั่วไป → ส่งออก/นำเข้า JSON ทำงานเหมือนเดิมทุกโหมด แนะนำส่งออกเก็บไว้เป็นระยะ

**ลิงก์เชิญ (#join=) ของเวอร์ชันเก่า?**
โหมด Firebase ไม่ใช้แล้ว — ทุกคนแค่เปิด URL เว็บเดียวกัน ระบบซิงค์ให้เองอัตโนมัติ

**ไม่อยากใช้ GitHub Pages ใช้อย่างอื่นได้ไหม?**
ได้ — `npm run build` แล้วเอาโฟลเดอร์ `dist/` ไปวางที่ไหนก็ได้ (Firebase Hosting, Netlify, Vercel)
ถ้าใช้ Firebase Hosting: `npm i -g firebase-tools && firebase init hosting` (เลือก dist) `&& firebase deploy`

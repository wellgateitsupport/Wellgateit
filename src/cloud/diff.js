/**
 * diff.js — pure helpers สำหรับ Firebase sync (ไม่มี dependency, unit-test ได้ตรงๆ)
 *
 * โมเดล baseline: เก็บ "ภาพล่าสุดที่ remote มี" แล้ว diff state ปัจจุบันกับ baseline
 * → push เฉพาะส่วนต่าง (per-record สำหรับ requests/users, ทั้งก้อนสำหรับ collection เล็ก)
 * → remote-won records == baseline เสมอ จึงไม่ถูก push กลับ (กัน echo loop โดยโครงสร้าง)
 */

// collection ที่ sync ทั้งหมด — ตรงกับ PERSIST_FIELDS ของระบบเดิม
export const COLLECTIONS = ['requests', 'activities', 'users', 'products', 'customers', 'optionLists'];

// requests/users = per-record fanout (ใหญ่/แก้พร้อมกันบ่อย), ที่เหลือ = ทั้งก้อน (เล็ก/มี cap)
export const KEYED = { requests: true, users: true };

// ค่า "ว่าง" ของแต่ละ collection — RTDB เก็บ array/object ว่างเป็น null
// ต้อง canonicalize สองฝั่งให้ตรงกัน ไม่งั้น null↔[] จะ diff ไม่จบ (push วนไม่รู้จบ)
const EMPTY_JSON = {
  requests: '{}', users: '{}', optionLists: '{}',
  activities: '[]', products: '[]', customers: '[]',
};

// ตัด undefined/function ออกแบบเดียวกับ JSON.stringify ของ bin sync เดิม
// (RTDB SDK ไม่รับ undefined — โยน error; JSON round-trip ให้ semantics ตรงเป๊ะกับของเดิม)
export const sanitize = (value) => {
  const json = JSON.stringify(value);
  return json === undefined ? null : JSON.parse(json);
};

// แปลงข้อมูลดิบจาก RTDB snapshot → รูปแบบที่ app ใช้
// - requests: object keyed by id → array (merge fns เดิมรับ array)
// - users/optionLists: object (null → {})
// - activities/products/customers: array (null → []; RTDB อาจคืน object ถ้า key เป็นเลขไม่ต่อเนื่อง)
export const normalizeCollection = (name, raw) => {
  if (raw == null) return name === 'users' || name === 'optionLists' ? {} : [];
  if (name === 'requests') return Array.isArray(raw) ? raw.filter(Boolean) : Object.values(raw);
  if (name === 'users' || name === 'optionLists') return raw;
  return Array.isArray(raw) ? raw : Object.values(raw);
};

// สร้าง baseline ของ collection หนึ่งจาก snapshot ดิบของ remote
// keyed → map id -> JSON string ต่อ record; ทั้งก้อน → JSON string เดียว (canonical empty)
export const baselineFromRemote = (name, raw) => {
  if (KEYED[name]) {
    const map = {};
    if (raw != null && typeof raw === 'object') {
      for (const [id, record] of Object.entries(raw)) {
        if (record != null) map[id] = JSON.stringify(sanitize(record));
      }
    }
    return map;
  }
  if (raw == null) return EMPTY_JSON[name];
  return JSON.stringify(sanitize(normalizeCollection(name, raw)));
};

// baseline เริ่มต้น (ยังไม่ hydrate) — ใช้ก่อน snapshot แรกมาถึง
export const emptyBaseline = () => ({
  requests: {}, users: {},
  activities: EMPTY_JSON.activities, products: EMPTY_JSON.products,
  customers: EMPTY_JSON.customers, optionLists: EMPTY_JSON.optionLists,
});

// ── diff หลัก: เทียบ state ปัจจุบันกับ baseline → multi-path updates + baseline ใหม่ ──
// updates: { 'requests/WR-26-0001': {...}, 'requests/WR-26-0002': null, 'products': [...] }
// (null = ลบ record ที่หายไปจาก state — เช่น danger zone "ล้างคำขอ")
export const computeFanout = (baseline, state) => {
  const updates = {};
  const next = {
    requests: { ...baseline.requests },
    users: { ...baseline.users },
    activities: baseline.activities,
    products: baseline.products,
    customers: baseline.customers,
    optionLists: baseline.optionLists,
  };

  // requests — array ของ record ที่มี id
  {
    const seen = new Set();
    for (const r of state.requests || []) {
      if (!r || !r.id) continue;
      seen.add(r.id);
      const clean = sanitize(r);
      const json = JSON.stringify(clean);
      if (baseline.requests[r.id] !== json) {
        updates[`requests/${r.id}`] = clean;
        next.requests[r.id] = json;
      }
    }
    for (const id of Object.keys(baseline.requests)) {
      if (!seen.has(id)) {
        updates[`requests/${id}`] = null;
        delete next.requests[id];
      }
    }
  }

  // users — object keyed by id
  {
    const seen = new Set();
    for (const [id, u] of Object.entries(state.users || {})) {
      if (!u) continue;
      seen.add(id);
      const clean = sanitize(u);
      const json = JSON.stringify(clean);
      if (baseline.users[id] !== json) {
        updates[`users/${id}`] = clean;
        next.users[id] = json;
      }
    }
    for (const id of Object.keys(baseline.users)) {
      if (!seen.has(id)) {
        updates[`users/${id}`] = null;
        delete next.users[id];
      }
    }
  }

  // collection ทั้งก้อน
  for (const name of ['activities', 'products', 'customers', 'optionLists']) {
    const clean = sanitize(state[name] ?? (EMPTY_JSON[name] === '[]' ? [] : {}));
    const json = JSON.stringify(clean);
    if (baseline[name] !== json) {
      // ค่าว่าง push เป็น null (canonical ของ RTDB) — echo กลับมาจะ baseline ตรงกันพอดี
      updates[name] = json === EMPTY_JSON[name] ? null : clean;
      next[name] = json;
    }
  }

  return { updates, baseline: next };
};

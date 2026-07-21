// unit tests ของ src/cloud/diff.js — logic ใหม่ทั้งหมดของ Firebase sync
// (pure module, import ตรงได้ ไม่ต้อง bundle)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLECTIONS, sanitize, normalizeCollection, baselineFromRemote, emptyBaseline, computeFanout,
} from '../../src/cloud/diff.js';

const REQ = (id, updatedAt, extra = {}) => ({ id, title: 'ทดสอบ', updatedAt, ...extra });

test('sanitize: ตัด undefined ออกเหมือน JSON round-trip ของ bin sync เดิม', () => {
  assert.deepEqual(sanitize({ a: 1, b: undefined, c: null }), { a: 1, c: null });
  assert.deepEqual(sanitize([1, undefined, 2]), [1, null, 2]); // JSON semantics: undefined ใน array → null
  assert.equal(sanitize(undefined), null);
});

test('normalizeCollection: requests object→array, null→ค่าว่างที่ถูก type', () => {
  assert.deepEqual(normalizeCollection('requests', null), []);
  assert.deepEqual(normalizeCollection('users', null), {});
  assert.deepEqual(normalizeCollection('optionLists', null), {});
  assert.deepEqual(normalizeCollection('activities', null), []);
  const raw = { 'WR-26-0001': REQ('WR-26-0001', 5) };
  assert.deepEqual(normalizeCollection('requests', raw), [REQ('WR-26-0001', 5)]);
  // RTDB อาจคืน object แทน array สำหรับ collection แบบ list
  assert.deepEqual(normalizeCollection('products', { 0: { sku: 'A' }, 1: { sku: 'B' } }), [{ sku: 'A' }, { sku: 'B' }]);
});

test('computeFanout: push เฉพาะ record ที่เปลี่ยน (per-id fanout)', () => {
  const base = emptyBaseline();
  const r1 = REQ('WR-26-0001', 10);
  const state1 = { requests: [r1], users: {}, activities: [], products: [], customers: [], optionLists: {} };

  const { updates: u1, baseline: b1 } = computeFanout(base, state1);
  assert.deepEqual(Object.keys(u1), ['requests/WR-26-0001']);
  assert.deepEqual(u1['requests/WR-26-0001'], r1);

  // เปลี่ยน r1 + เพิ่ม r2 → push 2 keys เท่านั้น
  const r1b = REQ('WR-26-0001', 20);
  const r2 = REQ('PR-26-0301', 15);
  const state2 = { ...state1, requests: [r1b, r2] };
  const { updates: u2 } = computeFanout(b1, state2);
  assert.deepEqual(Object.keys(u2).sort(), ['requests/PR-26-0301', 'requests/WR-26-0001']);
});

test('computeFanout: echo no-op — state ตรงกับ baseline → ไม่มี update เลย', () => {
  const state = {
    requests: [REQ('WR-26-0001', 10)],
    users: { 'ACC-001': { id: 'ACC-001', updatedAt: 3 } },
    activities: [{ at: '21/07/2026 10:00', action: 'สร้าง' }],
    products: [{ sku: 'VITC-1000' }],
    customers: [{ id: 'C-1' }],
    optionLists: { eventType: { items: ['บูธ'], updatedAt: 1 } },
  };
  const { baseline } = computeFanout(emptyBaseline(), state);
  const { updates } = computeFanout(baseline, state);
  assert.deepEqual(updates, {}); // idempotent — ไม่มี push วนซ้ำ
});

test('computeFanout: record ที่หายไป → null (ลบบน RTDB)', () => {
  const state1 = { requests: [REQ('WR-26-0001', 1), REQ('WR-26-0002', 1)], users: {}, activities: [], products: [], customers: [], optionLists: {} };
  const { baseline } = computeFanout(emptyBaseline(), state1);
  const state2 = { ...state1, requests: [REQ('WR-26-0001', 1)] };
  const { updates } = computeFanout(baseline, state2);
  assert.deepEqual(updates, { 'requests/WR-26-0002': null });
});

test('computeFanout: collection ว่าง ↔ null RTDB — canonical กัน push วนไม่จบ', () => {
  const state = { requests: [], users: {}, activities: [], products: [], customers: [], optionLists: {} };
  // remote null ทุกชุด (เหมือนครั้งแรกสุด) → baseline จาก null ต้องเท่ากับ state ว่าง
  const base = emptyBaseline();
  for (const name of COLLECTIONS) {
    assert.equal(JSON.stringify(baselineFromRemote(name, null)), JSON.stringify(base[name]), name);
  }
  const { updates } = computeFanout(base, state);
  assert.deepEqual(updates, {});

  // มีของแล้วลบเหลือว่าง → push null (canonical RTDB) ไม่ใช่ []
  const withData = { ...state, activities: [{ at: '21/07/2026 10:00' }] };
  const { baseline: b2 } = computeFanout(base, withData);
  const { updates: u3, baseline: b3 } = computeFanout(b2, state);
  assert.equal(u3.activities, null);
  // echo null กลับมา → baseline ตรง → จบ ไม่วน
  const echoBaseline = { ...b3, activities: baselineFromRemote('activities', null) };
  assert.deepEqual(computeFanout(echoBaseline, state).updates, {});
});

test('baselineFromRemote: keyed collection สร้าง map ต่อ id ตรงกับที่ push ขึ้นไป', () => {
  const r = REQ('WR-26-0001', 7);
  const state = { requests: [r], users: {}, activities: [], products: [], customers: [], optionLists: {} };
  const { updates, baseline: afterPush } = computeFanout(emptyBaseline(), state);
  // จำลอง echo: remote ตอนนี้มีสิ่งที่เรา push
  const remoteRaw = { 'WR-26-0001': updates['requests/WR-26-0001'] };
  assert.deepEqual(baselineFromRemote('requests', remoteRaw), afterPush.requests);
});

test('computeFanout: whole-node collection push ทั้งก้อนเมื่อเปลี่ยน', () => {
  const state1 = { requests: [], users: {}, activities: [], products: [{ sku: 'A', stock: 1 }], customers: [], optionLists: {} };
  const { baseline } = computeFanout(emptyBaseline(), state1);
  const state2 = { ...state1, products: [{ sku: 'A', stock: 2 }] };
  const { updates } = computeFanout(baseline, state2);
  assert.deepEqual(updates, { products: [{ sku: 'A', stock: 2 }] });
});

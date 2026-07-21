// unit tests ของ merge fns เดิมจาก binSync.js (สกัดจากไฟล์ต้นฉบับ ไม่แก้ไข)
// — พิสูจน์ semantics ที่ Firebase sync พึ่งพา: updatedAt wins, union, idempotence
// import ผ่าน bundle เพราะ dependency chain มี JSX (core.jsx) — ดู scripts/bundle-for-tests.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeRequests, mergeActivities, mergeUsersById, mergeArrayByKey, _reqRecency } from './.build/binSync.bundle.mjs';

const REQ = (id, updatedAt, extra = {}) => ({ id, updatedAt, ...extra });

test('mergeRequests: updatedAt สูงกว่าชนะ (ทั้งสองทิศ)', () => {
  const local = [REQ('WR-26-0001', 10, { title: 'local' })];
  const remoteNewer = [REQ('WR-26-0001', 20, { title: 'remote' })];
  assert.equal(mergeRequests(local, remoteNewer)[0].title, 'remote');
  const remoteOlder = [REQ('WR-26-0001', 5, { title: 'remote' })];
  assert.equal(mergeRequests(local, remoteOlder)[0].title, 'local');
});

test('mergeRequests: union — record ที่มีฝั่งเดียวไม่หาย', () => {
  const local = [REQ('WR-26-0001', 1)];
  const remote = [REQ('PR-26-0301', 1)];
  const merged = mergeRequests(local, remote);
  assert.deepEqual(merged.map(r => r.id).sort(), ['PR-26-0301', 'WR-26-0001']);
});

test('mergeRequests: idempotence — merge(a, a) == a', () => {
  const a = [REQ('WR-26-0001', 3, { flow: [{ status: 'approved', at: '20/07/2026 09:00' }] })];
  assert.deepEqual(mergeRequests(a, a), a);
});

test('mergeRequests: updatedAt เท่ากัน → _reqRecency ตัดสิน (step ที่อนุมัติแล้วมากกว่าชนะ)', () => {
  const less = REQ('WR-26-0001', 5, { flow: [{ status: 'pending' }] });
  const more = REQ('WR-26-0001', 5, { flow: [{ status: 'approved', at: '21/07/2026 10:00' }] });
  assert.ok(_reqRecency(more) > _reqRecency(less));
  assert.equal(mergeRequests([less], [more])[0].flow[0].status, 'approved');
  assert.equal(mergeRequests([more], [less])[0].flow[0].status, 'approved');
});

test('mergeActivities: dedupe + เรียงใหม่→เก่า + cap 500', () => {
  const a1 = { at: '21/07/2026 09:00', user: 'A', action: 'สร้าง', refId: 'X', summary: 's1' };
  const a2 = { at: '21/07/2026 11:00', user: 'B', action: 'อนุมัติ', refId: 'X', summary: 's2' };
  const merged = mergeActivities([a1], [a2, a1]); // a1 ซ้ำสองฝั่ง
  assert.equal(merged.length, 2);
  assert.equal(merged[0].at, '21/07/2026 11:00'); // ใหม่ก่อน

  const many = Array.from({ length: 600 }, (_, i) =>
    ({ at: `01/07/2026 ${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}`, user: 'U', action: 'a', refId: String(i), summary: '' }));
  assert.equal(mergeActivities(many, []).length, 500);
});

test('mergeUsersById: updatedAt ใหม่กว่าชนะ — ตั้งรหัสผ่านเครื่องนี้ไม่โดน copy เก่าทับ', () => {
  const local = { 'ACC-001': { id: 'ACC-001', updatedAt: 10, passwordHash: 'ตั้งแล้ว' } };
  const remoteOld = { 'ACC-001': { id: 'ACC-001', updatedAt: 5 }, 'MKT-002': { id: 'MKT-002' } };
  const merged = mergeUsersById(local, remoteOld);
  assert.equal(merged['ACC-001'].passwordHash, 'ตั้งแล้ว');
  assert.ok(merged['MKT-002']); // union
});

test('mergeArrayByKey: union โดย remote ทับเมื่อ key ชนกัน', () => {
  const merged = mergeArrayByKey([{ sku: 'A', stock: 1 }, { sku: 'B', stock: 9 }], [{ sku: 'A', stock: 2 }], 'sku');
  assert.deepEqual(merged.find(p => p.sku === 'A').stock, 2);
  assert.equal(merged.length, 2);
});

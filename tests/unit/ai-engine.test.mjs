// unit tests ของ AI ชั้น local — answerLocal (เข้าใจคำถามไทย) + buildAIContext
import test from 'node:test';
import assert from 'node:assert/strict';
import { answerLocal } from '../../src/ai/localEngine.js';
import { buildAIContext } from '../../src/ai/context.js';

const NOW = new Date(2026, 6, 24); // 24/07/2026
const USERS = {
  'MKT-001': { id: 'MKT-001', name: 'วิภา สุขใจ', roleTh: 'หัวหน้าการตลาด', dept: 'การตลาด', level: 'head' },
  'MKT-002': { id: 'MKT-002', name: 'สมชาย ใจดี', roleTh: 'พนักงานการตลาด', dept: 'การตลาด', level: 'staff' },
  'ACC-004': { id: 'ACC-004', name: 'ประทีป คงมั่น', roleTh: 'ผู้อำนวยการบัญชี', dept: 'บัญชี', level: 'director' },
};
const REQS = [
  { id: 'GN-26-0300', type: 'general', status: 'pending', title: 'ทำป้ายประชาสัมพันธ์', requester: 'MKT-002', amount: 0, createdAt: '22/07/2026 10:00', dueDate: '29/07/2026', currentStep: 0, flow: [{ userId: 'MKT-001', status: 'pending' }] },
  // completed แล้ว — แม้ dueDate ผ่านไปก็ไม่นับ overdue (งานปิดแล้ว)
  { id: 'EX-26-0198', type: 'expense', status: 'completed', title: 'เบิกค่าเดินทางเชียงใหม่', requester: 'MKT-002', amount: 8340, createdAt: '05/07/2026 09:00', dueDate: '12/07/2026', currentStep: 1, flow: [{ userId: 'MKT-001', status: 'approved' }] },
  { id: 'PO-26-0123', type: 'purchase', status: 'pending', title: 'จัดซื้อโน้ตบุ๊กฝ่ายขาย', requester: 'ACC-004', amount: 189500, createdAt: '10/06/2026 14:00', dueDate: '20/07/2026', currentStep: 0, flow: [{ userId: 'MKT-001', status: 'pending' }], pendingClear: false },
];
const DATA = {
  requests: REQS,
  myRequests: REQS.filter((r) => r.requester === 'MKT-002'),
  pendingForMe: REQS.filter((r) => r.status === 'pending' && r.flow[r.currentStep].userId === 'MKT-001'),
  users: USERS,
  products: [{ sku: 'VITC-1000', name: 'Vitamin C', nameTh: 'วิตามินซี 1000มก.', unit: 'ขวด', price: 320, stock: 1240 }],
  customers: [],
  currentUser: USERS['MKT-001'],
  now: NOW,
};

test('ถามด้วยรหัสคำขอ → สถานะ + คนที่กำลังรอ', () => {
  const a = answerLocal('GN-26-0300 ถึงไหนแล้ว', DATA);
  assert.match(a.text, /GN-26-0300/);
  assert.match(a.text, /รออนุมัติ/);
  assert.match(a.text, /วิภา สุขใจ/); // ผู้อนุมัติ step ปัจจุบัน
  assert.equal(a.items[0].id, 'GN-26-0300');
});

test('รอฉันอนุมัติ → คืนรายการที่ค้างอยู่ที่ผู้ถาม', () => {
  const a = answerLocal('มีอะไรรอฉันอนุมัติบ้าง', DATA);
  assert.match(a.text, /2 รายการ/);
  assert.deepEqual(a.items.map((i) => i.id).sort(), ['GN-26-0300', 'PO-26-0123']);
});

test('คำขอของฉัน → นับถูกและแสดงเฉพาะที่ยังไม่จบก่อน', () => {
  const a = answerLocal('คำขอของฉันถึงไหนแล้ว', DATA);
  assert.match(a.text, /2 รายการ/); // MKT-002 มี 2 (ใช้ currentUser คนละคนไม่เกี่ยว — myRequests ถูก inject แล้ว)
  assert.equal(a.items[0].id, 'GN-26-0300'); // pending มาก่อน
});

test('เกินกำหนด → PO-26-0123 (due 20/07 < now 24/07, ยัง pending)', () => {
  const a = answerLocal('มีอะไรเกินกำหนดบ้าง', DATA);
  assert.match(a.text, /1 รายการ/);
  assert.equal(a.items[0].id, 'PO-26-0123');
});

test('ยอดเงินตามประเภท+เดือน: เบิกเงินเดือนนี้ = 8,340', () => {
  const a = answerLocal('ยอดเบิกเงินเดือนนี้เท่าไหร่', DATA);
  assert.match(a.text, /8,340/);
  assert.match(a.text, /เดือนนี้/);
});

test('นับตามสถานะ: รออนุมัติกี่รายการ = 2', () => {
  const a = answerLocal('รออนุมัติกี่รายการ', DATA);
  assert.match(a.text, /2 รายการ/);
});

test('สต๊อก: ถามชื่อสินค้า → จำนวนคงเหลือ', () => {
  const a = answerLocal('สต๊อกวิตามินซีเหลือเท่าไหร่', DATA);
  assert.match(a.text, /1,240/);
});

test('คน: ใครอยู่แผนกการตลาด → รายชื่อ 2 คน', () => {
  const a = answerLocal('ใครอยู่แผนกการตลาดบ้าง', DATA);
  assert.match(a.text, /2 คน/);
  assert.match(a.text, /สมชาย ใจดี/);
});

test('fallback: ค้นคำในหัวข้อ', () => {
  const a = answerLocal('โน้ตบุ๊ก', DATA);
  assert.equal(a.items[0].id, 'PO-26-0123');
});

test('ไม่รู้จักคำถาม → แนะนำตัวอย่าง ไม่พัง', () => {
  const a = answerLocal('อากาศวันนี้เป็นยังไง', DATA);
  assert.match(a.text, /ยังไม่เข้าใจ/);
});

test('buildAIContext: มีสรุป+รายการสำคัญ และไม่เกินเพดานขนาด', () => {
  const ctx = buildAIContext(DATA);
  assert.match(ctx, /คำขอทั้งหมด 3/);
  assert.match(ctx, /GN-26-0300/);
  assert.match(ctx, /เกินกำหนด 1/);
  assert.match(ctx, /วิตามินซี/);
  assert.ok(ctx.length <= 6100);
});

test('buildAIContext: ข้อมูลใหญ่ถูกตัดทอนที่เพดาน', () => {
  const many = Array.from({ length: 400 }, (_, i) => ({
    id: `WR-26-${String(i).padStart(4, '0')}`, type: 'withdrawal', status: 'pending',
    title: 'คำขอทดสอบยาวๆ '.repeat(300), requester: 'MKT-002', amount: 1000,
    createdAt: '01/07/2026 09:00', dueDate: '30/07/2026', currentStep: 0, flow: [{ userId: 'MKT-001' }],
  }));
  const ctx = buildAIContext({ ...DATA, requests: many, myRequests: many, pendingForMe: many });
  assert.ok(ctx.length <= 6100);
  assert.match(ctx, /ตัดทอน/);
});

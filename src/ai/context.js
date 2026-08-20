/**
 * context.js — สรุปข้อมูลในแอพเป็นข้อความกระชับ ส่งให้ Claude AI เป็นบริบท
 * (pure function — unit test ได้ตรง; ผู้เรียกส่งข้อมูลที่ผ่านสิทธิ์การมองเห็นแล้วเท่านั้น)
 *
 * หลักการ: ส่งเฉพาะที่จำเป็น (ประหยัด token + จำกัดข้อมูลตามสิทธิ์ของคนถาม)
 * เพดานขนาด ~6,000 ตัวอักษร
 */

const MAX_CHARS = 6000;

const parseDT = (s) => {
  if (!s) return null;
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
};
const CLOSED = new Set(['completed', 'rejected', 'cancelled']);

const reqLine = (r, users) => {
  const who = users[r.requester]?.name || r.requester;
  const step = r.status === 'pending' && r.flow?.[r.currentStep] ? ` รอ:${users[r.flow[r.currentStep].userId]?.name || '?'}` : '';
  return `${r.id}|${r.type}|${r.status}|${r.title}|ผู้ขอ:${who}|฿${r.amount || 0}|กำหนด:${r.dueDate || '-'}${step}`;
};

export const buildAIContext = (data) => {
  const { requests = [], myRequests = [], pendingForMe = [], users = {}, products = [], currentUser, now = new Date() } = data;

  const byStatus = {};
  const byType = {};
  let totalAmount = 0;
  for (const r of requests) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    byType[r.type] = (byType[r.type] || 0) + 1;
    if (!['rejected', 'cancelled'].includes(r.status)) totalAmount += Number(r.amount) || 0;
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const overdue = requests.filter((r) => !CLOSED.has(r.status) && parseDT(r.dueDate) && parseDT(r.dueDate) < today);
  const recent = [...requests]
    .sort((a, b) => (parseDT(b.createdAt)?.getTime() || 0) - (parseDT(a.createdAt)?.getTime() || 0))
    .slice(0, 15);

  const deptCount = {};
  for (const u of Object.values(users)) if (u) deptCount[u.dept] = (deptCount[u.dept] || 0) + 1;

  const sections = [
    `วันนี้: ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`,
    `ผู้ถาม: ${currentUser?.name || '-'} (${currentUser?.roleTh || ''} แผนก ${currentUser?.dept || '-'})`,
    `## สรุปรวม (เฉพาะที่ผู้ถามมีสิทธิ์เห็น)\nคำขอทั้งหมด ${requests.length} | สถานะ: ${JSON.stringify(byStatus)} | ประเภท: ${JSON.stringify(byType)} | มูลค่ารวม(ไม่รวมที่ปฏิเสธ/ยกเลิก): ฿${totalAmount.toLocaleString('th-TH')} | เกินกำหนด ${overdue.length}`,
    pendingForMe.length ? `## รอผู้ถามอนุมัติ (${pendingForMe.length})\n${pendingForMe.slice(0, 10).map((r) => reqLine(r, users)).join('\n')}` : '## รอผู้ถามอนุมัติ: ไม่มี',
    myRequests.length ? `## คำขอของผู้ถาม (${myRequests.length}, แสดง 10 ล่าสุด)\n${myRequests.slice(0, 10).map((r) => reqLine(r, users)).join('\n')}` : '## คำขอของผู้ถาม: ไม่มี',
    overdue.length ? `## เกินกำหนด\n${overdue.slice(0, 10).map((r) => reqLine(r, users)).join('\n')}` : '',
    `## คำขอล่าสุด 15 รายการ\n${recent.map((r) => reqLine(r, users)).join('\n')}`,
    `## สต๊อกสินค้า\n${products.map((p) => `${p.sku}|${p.nameTh || p.name}|เหลือ ${p.stock} ${p.unit || ''}|฿${p.price}`).join('\n')}`,
    `## ทีมงานตามแผนก\n${Object.entries(deptCount).map(([d, n]) => `${d}: ${n} คน`).join(' | ')}`,
  ].filter(Boolean);

  let out = sections.join('\n\n');
  if (out.length > MAX_CHARS) out = out.slice(0, MAX_CHARS) + '\n…(ตัดทอน)';
  return out;
};

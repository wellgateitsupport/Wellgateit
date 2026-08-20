/**
 * localEngine.js — ผู้ช่วยตอบคำถามภาษาไทยจากข้อมูลในแอพ (ชั้นฟรี ไม่ใช้ LLM)
 *
 * pure function ทั้งไฟล์ — ไม่ import อะไรจากแอพ เพื่อให้ unit test ตรงๆ ได้
 * ผู้เรียก (AssistantPanel) เตรียมข้อมูลที่ "ผ่านสิทธิ์การมองเห็นแล้ว" มาให้:
 *   data = { requests, myRequests, pendingForMe, users, products, customers, currentUser, now }
 *
 * คืนค่า: { text, items? } — items = รายการคำขอที่คลิกเปิดได้ [{ id, title, sub }]
 */

// ── สถานะ/ประเภท: คำไทย → key ──
const STATUS_TH = {
  pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ปฏิเสธ',
  revision: 'ตีกลับแก้ไข', completed: 'เสร็จสมบูรณ์', cancelled: 'ยกเลิก',
};
const TYPE_TH = {
  withdrawal: 'เบิกตัดขาด', borrow: 'ยืม-คืน', expense: 'เบิกเงิน/IOU', event: 'อีเว้นท์',
  purchase: 'จัดซื้อ', overtime: 'OT', leave: 'ใบลา', hire: 'ขอเพิ่มพนักงาน', general: 'อนุมัติทั่วไป',
};
const TYPE_WORDS = [
  ['withdrawal', ['เบิกของ', 'เบิกตัดขาด', 'เบิกสินค้า']],
  ['borrow', ['ยืม', 'คืนของ', 'ยืมคืน', 'ยืม-คืน']],
  ['expense', ['เบิกเงิน', 'iou', 'เงินทดรอง', 'ค่าใช้จ่าย']],
  ['event', ['อีเว้นท์', 'อีเวนต์', 'จัดงาน', 'บูธ', 'event']],
  ['purchase', ['จัดซื้อ', 'ขอซื้อ', 'ซื้อของ']],
  ['overtime', ['โอที', 'ล่วงเวลา', 'ot']],
  ['leave', ['ใบลา', 'ลาป่วย', 'ลากิจ', 'ลาพักร้อน', 'การลา']],
  ['hire', ['จ้าง', 'พนักงานใหม่', 'เพิ่มคน', 'อัตรากำลัง', 'รับสมัคร']],
  ['general', ['ทั่วไป']],
];
const STATUS_WORDS = [
  ['approved', ['อนุมัติแล้ว', 'ผ่านแล้ว', 'ผ่านการอนุมัติ']],
  ['pending', ['รออนุมัติ', 'ยังไม่อนุมัติ', 'ค้างอนุมัติ', 'รอการอนุมัติ']],
  ['rejected', ['ปฏิเสธ', 'ไม่ผ่าน', 'โดนปัด']],
  ['revision', ['ตีกลับ', 'แก้ไข']],
  ['completed', ['เสร็จสมบูรณ์', 'เสร็จแล้ว', 'จบงาน', 'ปิดงาน']],
  ['cancelled', ['ยกเลิก']],
];
const MONTHS_TH = [
  ['01', ['ม.ค', 'มกราคม']], ['02', ['ก.พ', 'กุมภาพันธ์']], ['03', ['มี.ค', 'มีนาคม']],
  ['04', ['เม.ย', 'เมษายน']], ['05', ['พ.ค', 'พฤษภาคม']], ['06', ['มิ.ย', 'มิถุนายน']],
  ['07', ['ก.ค', 'กรกฎาคม']], ['08', ['ส.ค', 'สิงหาคม']], ['09', ['ก.ย', 'กันยายน']],
  ['10', ['ต.ค', 'ตุลาคม']], ['11', ['พ.ย', 'พฤศจิกายน']], ['12', ['ธ.ค', 'ธันวาคม']],
];

const OPEN_STATUSES = new Set(['pending', 'revision']);
const CLOSED_STATUSES = new Set(['completed', 'rejected', 'cancelled']);

// ── helpers ──
const parseDT = (s) => {
  if (!s) return null;
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0));
};
const baht = (n) => '฿' + Number(n || 0).toLocaleString('th-TH');
const has = (q, words) => words.some((w) => q.includes(w));
const item = (r) => ({
  id: r.id,
  title: r.title || '(ไม่มีหัวข้อ)',
  sub: `${TYPE_TH[r.type] || r.type} · ${STATUS_TH[r.status] || r.status}${r.amount ? ' · ' + baht(r.amount) : ''}`,
});
const listText = (label, rs) => `${label} ${rs.length} รายการ${rs.length ? ' — แตะเพื่อเปิดดูได้เลย:' : ''}`;
const cap = (rs, n = 8) => rs.slice(0, n);

const detectType = (q) => { for (const [k, ws] of TYPE_WORDS) if (has(q, ws)) return k; return null; };
const detectStatus = (q) => { for (const [k, ws] of STATUS_WORDS) if (has(q, ws)) return k; return null; };
const detectMonth = (q, now) => {
  if (q.includes('เดือนนี้')) return { mm: String(now.getMonth() + 1).padStart(2, '0'), yyyy: now.getFullYear(), label: 'เดือนนี้' };
  if (q.includes('เดือนที่แล้ว') || q.includes('เดือนก่อน')) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { mm: String(d.getMonth() + 1).padStart(2, '0'), yyyy: d.getFullYear(), label: 'เดือนที่แล้ว' };
  }
  for (const [mm, ws] of MONTHS_TH) if (has(q, ws)) return { mm, yyyy: now.getFullYear(), label: ws[ws.length - 1] };
  return null;
};
const inMonth = (r, mo) => {
  const d = parseDT(r.createdAt);
  return d && String(d.getMonth() + 1).padStart(2, '0') === mo.mm && d.getFullYear() === mo.yyyy;
};
const overdueOf = (requests, now) => requests.filter((r) => {
  if (CLOSED_STATUSES.has(r.status)) return false;
  const d = parseDT(r.dueDate);
  return d && d < new Date(now.getFullYear(), now.getMonth(), now.getDate());
});

// ── main ──
export const answerLocal = (question, data) => {
  const q = String(question || '').toLowerCase().trim();
  const { requests = [], myRequests = [], pendingForMe = [], users = {}, products = [], currentUser, now = new Date() } = data;

  if (!q) return { text: 'พิมพ์คำถามได้เลยครับ เช่น "รอฉันอนุมัติกี่รายการ" หรือ "ยอดเบิกเงินเดือนนี้เท่าไหร่"' };

  // 1) ถาม ID ตรงๆ เช่น "WR-26-0341 ถึงไหนแล้ว"
  const idm = q.toUpperCase().match(/([A-Z]{2}-\d{2}-\d{4})/);
  if (idm) {
    const r = requests.find((x) => x.id === idm[1]);
    if (!r) return { text: `ไม่พบคำขอ ${idm[1]} ในข้อมูลที่คุณมีสิทธิ์เห็นครับ` };
    const step = r.flow?.[r.currentStep];
    const stepUser = step && users[step.userId];
    const parts = [
      `${r.id} — ${r.title}`,
      `สถานะ: ${STATUS_TH[r.status] || r.status}`,
      r.status === 'pending' && stepUser ? `รอ: ${stepUser.name} (ขั้นที่ ${r.currentStep + 1}/${r.flow.length})` : null,
      r.dueDate ? `ครบกำหนด: ${r.dueDate}` : null,
      r.amount ? `มูลค่า: ${baht(r.amount)}` : null,
    ].filter(Boolean);
    return { text: parts.join('\n'), items: [item(r)] };
  }

  // 2) รอฉันอนุมัติ
  if ((q.includes('อนุมัติ') && has(q, ['รอฉัน', 'รอผม', 'ต้อง', 'ค้าง', 'ของฉัน', 'มีอะไร', 'กี่'])) || has(q, ['ต้องเซ็น', 'รอเซ็น'])) {
    if (!detectStatus(q) || q.includes('รอ')) {
      return pendingForMe.length
        ? { text: listText(`มีคำขอรอคุณอนุมัติ`, pendingForMe), items: cap(pendingForMe).map(item) }
        : { text: 'ตอนนี้ไม่มีคำขอที่รอคุณอนุมัติครับ 🎉' };
    }
  }

  // 3) คำขอของฉัน
  if (has(q, ['คำขอของฉัน', 'คำขอของผม', 'ที่ฉันส่ง', 'ที่ผมส่ง', 'ของฉันถึงไหน', 'คำขอฉัน'])) {
    const open = myRequests.filter((r) => !CLOSED_STATUSES.has(r.status));
    if (!myRequests.length) return { text: 'คุณยังไม่มีคำขอในระบบครับ — กดปุ่ม "สร้างคำขอ" มุมบนขวาเพื่อเริ่ม' };
    return {
      text: `คุณมีคำขอทั้งหมด ${myRequests.length} รายการ (ยังไม่จบ ${open.length})${open.length ? ' — รายการที่ยังดำเนินอยู่:' : ''}`,
      items: cap(open.length ? open : myRequests).map(item),
    };
  }

  // 4) เกินกำหนด / SLA
  if (has(q, ['เกินกำหนด', 'เกิน sla', 'เลยกำหนด', 'ล่าช้า', 'ค้างนาน', 'overdue'])) {
    const od = overdueOf(requests, now);
    return od.length
      ? { text: listText('มีคำขอเกินกำหนด', od), items: cap(od).map(item) }
      : { text: 'ไม่มีคำขอเกินกำหนดครับ 🎉' };
  }

  // 5) สต๊อก (ต้องมาก่อนยอดเงิน — คำถามสต๊อกมักลงท้าย "เท่าไหร่" เหมือนกัน)
  if (has(q, ['สต๊อก', 'สต็อก', 'คงเหลือ', 'ของเหลือ', 'สินค้าเหลือ'])) {
    // จับบางส่วนของชื่อได้ เช่น "วิตามินซี" ใน "วิตามินซี 1000มก." (แยก token ยาว ≥3 มาเทียบ)
    const tokensOf = (p) => `${p.nameTh || ''} ${p.name || ''} ${p.sku || ''}`.toLowerCase().split(/[\s/\-]+/).filter((t) => t.length >= 3);
    const hit = products.filter((p) => tokensOf(p).some((t) => q.includes(t)));
    const list = (hit.length ? hit : products).map((p) => `· ${p.nameTh || p.name}: ${Number(p.stock).toLocaleString('th-TH')} ${p.unit || ''}`);
    return { text: (hit.length ? 'สต๊อกที่ถาม:' : 'สต๊อกคงเหลือทั้งหมด:') + '\n' + list.join('\n') };
  }

  // 6) ยอดเงิน
  if (has(q, ['ยอด', 'มูลค่า', 'กี่บาท', 'เท่าไหร่', 'เท่าไร', 'รวมเงิน'])) {
    const type = detectType(q);
    const mo = detectMonth(q, now);
    let rs = requests.filter((r) => !['rejected', 'cancelled'].includes(r.status));
    if (type) rs = rs.filter((r) => r.type === type);
    if (mo) rs = rs.filter((r) => inMonth(r, mo));
    const sum = rs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const scope = [type ? TYPE_TH[type] : 'ทุกประเภท', mo ? mo.label : 'ทั้งหมด'].join(' · ');
    return {
      text: `ยอดรวม (${scope}): ${baht(sum)} จาก ${rs.length} รายการ`,
      items: cap([...rs].sort((a, b) => (b.amount || 0) - (a.amount || 0)), 5).map(item),
    };
  }

  // 7) คน/แผนก
  if (has(q, ['ใครอยู่', 'มีใครบ้าง', 'หัวหน้า', 'ผู้จัดการ', 'ผู้อำนวยการ', 'ทีมงาน', 'พนักงานกี่'])) {
    const all = Object.values(users).filter(Boolean);
    const deptHit = all.find((u) => u.dept && q.includes(String(u.dept).toLowerCase()));
    if (deptHit) {
      const inDept = all.filter((u) => u.dept === deptHit.dept);
      const wantHead = has(q, ['หัวหน้า', 'ผู้จัดการ', 'ผู้อำนวยการ']);
      const picked = wantHead ? inDept.filter((u) => u.level !== 'staff') : inDept;
      return { text: `${deptHit.dept} มี ${inDept.length} คน${wantHead ? ' — ระดับหัวหน้าขึ้นไป:' : ':'}\n` + picked.map((u) => `· ${u.name} — ${u.roleTh || u.level}`).join('\n') };
    }
    return { text: `ทีมทั้งหมด ${all.length} คน — ลองถามเจาะแผนก เช่น "ใครอยู่แผนกการตลาดบ้าง" หรือ "หัวหน้าบัญชีคือใคร"` };
  }

  // 8) เคลียร์เอกสาร
  if (has(q, ['เคลียร์', 'ใบเสร็จ', 'เอกสารค้าง'])) {
    const pend = requests.filter((r) => r.pendingClear && !CLOSED_STATUSES.has(r.status));
    return pend.length
      ? { text: listText('มีรายการค้างเคลียร์เอกสาร', pend), items: cap(pend).map(item) }
      : { text: 'ไม่มีรายการค้างเคลียร์เอกสารครับ' };
  }

  // 9) นับจำนวน (ตามสถานะ/ประเภท/เดือน)
  if (has(q, ['กี่รายการ', 'กี่อัน', 'กี่เรื่อง', 'กี่งาน', 'จำนวน', 'ทั้งหมด', 'มีเท่าไหร่', 'สรุป'])) {
    const type = detectType(q);
    const status = detectStatus(q);
    const mo = detectMonth(q, now);
    let rs = requests;
    if (type) rs = rs.filter((r) => r.type === type);
    if (status) rs = rs.filter((r) => r.status === status);
    if (mo) rs = rs.filter((r) => inMonth(r, mo));
    if (type || status || mo) {
      const scope = [type && TYPE_TH[type], status && STATUS_TH[status], mo && mo.label].filter(Boolean).join(' · ');
      return { text: `${scope}: ${rs.length} รายการ`, items: cap(rs).map(item) };
    }
    // สรุปรวม
    const byStatus = {};
    rs.forEach((r) => { byStatus[r.status] = (byStatus[r.status] || 0) + 1; });
    const lines = Object.entries(byStatus).map(([k, n]) => `· ${STATUS_TH[k] || k}: ${n}`);
    const od = overdueOf(rs, now);
    return { text: `คำขอทั้งหมด ${rs.length} รายการ\n${lines.join('\n')}${od.length ? `\n⚠️ เกินกำหนด ${od.length} รายการ` : ''}` };
  }

  // 10) ความเคลื่อนไหวล่าสุด
  if (has(q, ['ล่าสุด', 'มีอะไรใหม่', 'อัปเดต', 'เมื่อกี้', 'วันนี้มีอะไร'])) {
    const recent = [...requests].sort((a, b) => (parseDT(b.createdAt)?.getTime() || 0) - (parseDT(a.createdAt)?.getTime() || 0));
    return { text: 'คำขอล่าสุดในระบบ:', items: cap(recent, 6).map(item) };
  }

  // 11) ทักทาย/ช่วยเหลือ
  if (has(q, ['สวัสดี', 'หวัดดี', 'ช่วยอะไร', 'ทำอะไรได้', 'วิธีใช้', 'help', 'hello', 'hi'])) {
    return {
      text: `สวัสดีครับ${currentUser ? ' คุณ' + currentUser.name : ''} 👋 ผมตอบคำถามจากข้อมูลในระบบได้ เช่น\n· "รอฉันอนุมัติกี่รายการ"\n· "คำขอของฉันถึงไหนแล้ว"\n· "มีอะไรเกินกำหนดบ้าง"\n· "ยอดเบิกเงินเดือนนี้เท่าไหร่"\n· "สต๊อกวิตามินซีเหลือเท่าไหร่"\n· พิมพ์รหัสคำขอ เช่น "WR-26-0341" เพื่อเช็คสถานะ`,
    };
  }

  // 12) fallback: ค้นหาจากคำสำคัญในหัวข้อ/รายละเอียด
  const words = q.split(/\s+/).filter((w) => w.length >= 2);
  const found = requests.filter((r) => {
    const hay = `${r.id} ${r.title || ''} ${r.purpose || ''}`.toLowerCase();
    return words.some((w) => hay.includes(w));
  });
  if (found.length) return { text: listText(`พบคำขอที่เกี่ยวกับ "${question}"`, found), items: cap(found).map(item) };

  return {
    text: `ผมยังไม่เข้าใจคำถามนี้ครับ 🙏 ลองถามแบบนี้ได้:\n· "รอฉันอนุมัติกี่รายการ"\n· "ยอดจัดซื้อเดือนนี้เท่าไหร่"\n· "ใครอยู่แผนกการตลาดบ้าง"\n\n(เปิดโหมด Claude AI ในปุ่มตั้งค่า ⚙ เพื่อให้ถามได้อิสระกว่านี้ — ดู SETUP-AI.md)`,
  };
};

import { test, expect } from '@playwright/test';

// ============================================================================
// Exam data-quality tests — กฎด้านบรรณาธิการของคลังข้อสอบ
// (bank.js ตรวจ "โครงสร้าง" ส่วนไฟล์นี้ตรวจ "คุณภาพเนื้อหา")
//
// 1. ห้ามยืมศัพท์เฉพาะของอีกวิชามาใช้เป็นตัวเลือกหรือโจทย์
// 2. ตัวเลือกต้องยาวพอ ๆ กัน — คำตอบที่ยาวกว่าตัวลวงมากทำให้เดาได้โดยไม่ต้องอ่าน
// 3. ตัวเลือกต้องอยู่ในรูปแบบเดียวกัน — ตัวที่ภาษาแปลกออกมาตัวเดียวจะถูกตัดทิ้งง่าย
// ============================================================================

/** ศัพท์ที่ปรากฏเฉพาะในสไลด์ของแต่ละวิชา — ถ้าโผล่ในอีกวิชาถือว่าข้อสอบปนกัน */
const EXCLUSIVE = {
  sales: ['BANT', 'Prospecting', 'Qualified Lead', 'Cold Calling', 'Warm Calling', 'Cialdini',
    'Loss Aversion', 'Foot-in-the-Door', 'SPIN', 'FAB', 'AIDA', 'Value Selling', 'Consultative Selling',
    'SOLER', 'Paraphrasing', 'BATNA', 'Anchoring', 'Bundling', 'If-Then', 'Silence is Power',
    'Power Pose', 'Power Pause', 'Growth Mindset', 'Fixed Mindset', 'Self-Regulation', 'Self-Awareness',
    'HIQS', 'Challenger Sale', 'Trust Equation', 'Latent Need', 'Buyer Persona', 'Executive Summary',
    'Referral', 'Lead Qualification', 'Rackham', 'Goleman', 'Dweck', 'Zaltman', 'Kahneman', 'Mehrabian',
    'Cuddy', 'Angelou', 'Need-Payoff', 'Reciprocity', 'Social Proof', 'Scarcity', 'Rich Menu',
    'Auto-Reply', 'LINE OA', 'LinkedIn', 'Social Selling', 'Pain Point',
    'SMART Goals', 'Sales Goal', 'Personal Branding', 'Elevator Pitch', 'Sales Script',
    'Time-bound', 'Take Action'],
  mkt: ['Market Segmentation', 'Psychographic', 'Substantial', 'Differentiable', 'Actionable',
    'Product Positioning', 'STP', 'Value for Money', 'Country of Origin', 'Attractiveness',
    'Marketing Mix', '4Ps', '7Ps', 'Cost Leadership', 'Product Differentiation', 'Multimodal',
    'Collaborative Logistics', 'Joint Distribution', 'Omni-Channel', 'O2O', 'Tesla', 'Burger King',
    'Fire-Grilled', 'Localization', 'AOSTC', 'Farral', 'Lindsley', 'Monster Energy', 'Market Space',
    'MarTech', 'Real Time Marketing', 'Pop-up', 'Augmented Reality', 'Virtual Reality', 'TikToker',
    'YouTuber', 'Loyalty Program', 'Brand Loyalty', 'Netflix', 'IKEA', 'Google Ads', 'Warehouse',
    'Logistic',
    'Segmentation', 'Targeting', 'Positioning', 'Segment \u2192 Target', 'Geographic',
    'Perceptual Map', 'SMART Objectives'],
};

/**
 * ข้อยกเว้น: ศัพท์ที่สไลด์ของวิชานั้นสอนเองด้วย จึงไม่ถือว่าปน
 * (เช่น สไลด์การขายบทที่ 8 สอน Demographic/Psychographic เอง
 *  และสูตร Trust ของบทที่ 5 มีคำว่า Reliability อยู่ในสูตร)
 */
const ALLOWED = {
  sales: ['Psychographic', 'Reliability'],
  mkt: [],
};

const loadBank = (page) => page.evaluate(() => ({
  subjects: window.EXAM.subjects.map((s) => s.id),
  mc: window.EXAM.mc.map((q) => ({ id: q.id, subject: q.subject, q: q.q, choices: q.choices, answer: q.answer })),
  fill: window.EXAM.fill.map((q) => ({ id: q.id, subject: q.subject, q: q.q, accept: q.accept })),
  matchSets: window.EXAM.matchSets.map((s) => ({ id: s.id, subject: s.subject, title: s.title, items: s.items })),
}));

test('Quality A: ทุกข้อถูกแท็กวิชาตรงกับบทที่สังกัด และไม่มีข้อไหนหลุดข้ามวิชา', async ({ page }) => {
  await page.goto('/exam/');
  const problems = await page.evaluate(() => {
    const out = [];
    const chById = {};
    window.EXAM.chapters.forEach((c) => { chById[c.id] = c; });
    const all = [...window.EXAM.mc, ...window.EXAM.fill, ...window.EXAM.matchSets];
    all.forEach((q) => {
      const ch = chById[q.ch];
      if (!ch) out.push(`${q.id}: อ้างบทที่ไม่มีอยู่ (${q.ch})`);
      else if (ch.subject !== q.subject) out.push(`${q.id}: subject=${q.subject} แต่บท ${q.ch} เป็นของ ${ch.subject}`);
    });
    return out;
  });
  expect(problems, problems.join('\n')).toEqual([]);
});

test('Quality B: ตัวเลือกและโจทย์ต้องไม่ยืมศัพท์เฉพาะของอีกวิชามาใช้', async ({ page }) => {
  await page.goto('/exam/');
  const bank = await loadBank(page);
  const other = { sales: 'mkt', mkt: 'sales' };
  const hits = [];

  const partsOf = (q) => {
    if (q.items) {
      return [['หัวข้อชุด', q.title],
        ...q.items.flatMap((it, i) => [[`ข้อ${i + 1}`, it.q], [`คำตอบ${i + 1}`, it.answer]])];
    }
    const parts = [['โจทย์', q.q]];
    if (q.choices) q.choices.forEach((c, i) => parts.push([`ตัวเลือก ${i}`, c]));
    if (q.accept) q.accept.forEach((a, i) => parts.push([`คำตอบ ${i}`, a]));
    return parts;
  };

  for (const q of [...bank.mc, ...bank.fill, ...bank.matchSets]) {
    const foreign = (EXCLUSIVE[other[q.subject]] || [])
      .filter((t) => !(ALLOWED[q.subject] || []).includes(t));
    for (const [where, text] of partsOf(q)) {
      for (const term of foreign) {
        if (String(text).toLowerCase().includes(term.toLowerCase())) {
          hits.push(`[${q.subject}] ${q.id} · ${where} ยืมศัพท์ "${term}" — ${String(text).slice(0, 70)}`);
        }
      }
    }
  }
  expect(hits, `พบการยืมศัพท์ข้ามวิชา:\n${hits.join('\n')}`).toEqual([]);
});

test('Quality F: SMART ของสองวิชาใช้คนละตัวอักษร ห้ามสลับกัน', async ({ page }) => {
  await page.goto('/exam/');
  const bank = await loadBank(page);
  // สไลด์วิชาขายบทที่ 8: R = Relevant, T = Time-bound
  // สไลด์วิชาการตลาดบทที่ 8: R = Realistic, T = Timed
  const WRONG = { sales: ['Realistic', 'Timed'], mkt: ['Relevant', 'Time-bound'] };
  const hits = [];
  for (const q of bank.mc) {
    const text = [q.q, ...(q.choices || [])].join(' ');
    if (!/SMART/i.test(text)) continue;
    const correct = (q.choices || [])[q.answer] || '';
    for (const w of WRONG[q.subject]) {
      if (correct.includes(w)) hits.push(`[${q.subject}] ${q.id} — คำตอบถูกใช้ "${w}" ซึ่งเป็นนิยามของอีกวิชา`);
    }
  }
  expect(hits, hits.join('\n')).toEqual([]);
});

test('Quality C: คำตอบต้องไม่ยาวหรือสั้นกว่าตัวลวงจนเดาได้', async ({ page }) => {
  await page.goto('/exam/');
  const bank = await loadBank(page);
  const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  const tooLong = [];
  const tooShort = [];
  for (const q of bank.mc) {
    const lens = q.choices.map((c) => c.length);
    const correct = lens[q.answer];
    const others = lens.filter((_, i) => i !== q.answer);
    const maxOther = Math.max(...others);
    const minOther = Math.min(...others);
    if (correct > maxOther * 1.5 && correct - maxOther > 18) {
      tooLong.push(`${q.id}: คำตอบ ${correct} ตัวอักษร / ตัวลวงยาวสุด ${maxOther}`);
    }
    if (correct * 1.6 < minOther && median(others) - correct > 18) {
      tooShort.push(`${q.id}: คำตอบ ${correct} ตัวอักษร / ตัวลวงสั้นสุด ${minOther}`);
    }
  }
  expect(tooLong, `คำตอบยาวกว่าตัวลวงมากผิดปกติ:\n${tooLong.join('\n')}`).toEqual([]);
  expect(tooShort, `คำตอบสั้นกว่าตัวลวงมากผิดปกติ:\n${tooShort.join('\n')}`).toEqual([]);
});

test('Quality D: ตัวเลือกต้องอยู่ในรูปแบบเดียวกัน ไม่มีตัวที่ภาษาแปลกออกมาตัวเดียว', async ({ page }) => {
  await page.goto('/exam/');
  const bank = await loadBank(page);
  const isThai = (s) => /[฀-๿]/.test(s);
  const odd = [];

  for (const q of bank.mc) {
    const thai = q.choices.map(isThai);
    const nThai = thai.filter(Boolean).length;
    if (nThai === 0 || nThai === q.choices.length) continue;      // เข้าชุดกันอยู่แล้ว
    const minorityIsThai = nThai <= q.choices.length / 2;
    const outliers = q.choices.filter((_, i) => thai[i] === minorityIsThai);
    if (outliers.length === 1) {
      const isAnswer = q.choices[q.answer] === outliers[0];
      odd.push(`${q.id}${isAnswer ? ' (ตัวแปลกคือคำตอบ!)' : ''}: "${outliers[0].slice(0, 50)}"`);
    }
  }
  expect(odd, `ตัวเลือกไม่เข้าชุดกัน:\n${odd.join('\n')}`).toEqual([]);
});

test('Quality E: ข้อสอบที่สุ่มออกมาต้องเป็นของวิชาที่เลือกเท่านั้น', async ({ page }) => {
  await page.goto('/exam/');
  const leaks = await page.evaluate(() => {
    const E = window.EXAM;
    const shuffle = (a) => { const b = a.slice();
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      return b; };
    const out = [];
    for (const subj of E.subjects) {
      const chs = E.chapters.filter((c) => c.subject === subj.id).map((c) => c.id);
      for (let r = 0; r < 100; r++) {
        const picked = [
          ...shuffle(E.mc.filter((q) => q.subject === subj.id && chs.includes(q.ch))).slice(0, 40),
          ...shuffle(E.fill.filter((q) => q.subject === subj.id && chs.includes(q.ch))).slice(0, 10),
          ...shuffle(E.matchSets.filter((s) => s.subject === subj.id && chs.includes(s.ch))).slice(0, 2),
        ];
        picked.forEach((item) => { if (item.subject !== subj.id) out.push(`${subj.id}: ${item.id}`); });
      }
    }
    return out;
  });
  expect(leaks, `ข้อหลุดข้ามวิชา:\n${leaks.join('\n')}`).toEqual([]);
});

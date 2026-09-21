import { test, expect } from '@playwright/test';

// ============================================
// Exam app smoke tests — แอพทำข้อสอบที่ public/exam/ (static ล้วน ไม่พึ่ง FlowDesk)
// รันกับ production build เพื่อพิสูจน์ว่า service worker ของ FlowDesk ไม่ไปกินเส้นทาง /exam/
// ============================================

const collectPageErrors = (page) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err));
  return errors;
};

/** อ่านชนิดของข้อที่แสดงอยู่บนหน้าจอตอนนี้ */
const currentKind = (page) => page.evaluate(() => {
  if (document.querySelector('.word-pool')) return 'match';
  if (document.querySelector('.fill-input')) return 'fill';
  return 'mc';
});

/** ตอบข้อที่แสดงอยู่ให้ถูก โดยเทียบโจทย์กับคลังข้อสอบใน window.EXAM */
const answerCurrentCorrectly = async (page) => {
  const kind = await currentKind(page);

  if (kind === 'mc') {
    // เลือกด้วย index ที่เทียบข้อความแบบตรงตัว — hasText เป็น substring จึงพลาดได้
    // เมื่อตัวเลือกหนึ่งเป็นส่วนหนึ่งของอีกตัว (เช่น "Lead" กับ "Qualified Lead")
    const correctIndex = await page.evaluate(() => {
      const norm = (s) => s.replace(/_+/g, '').replace(/\s+/g, '');
      const asked = norm(document.querySelector('.q-text').textContent);
      const found = window.EXAM.mc.find((q) => norm(q.q) === asked);
      if (!found) return -1;
      const correct = norm(found.choices[found.answer]);
      return [...document.querySelectorAll('.choice .choice-text')]
        .findIndex((node) => norm(node.textContent) === correct);
    });
    expect(correctIndex, 'ต้องหาตัวเลือกที่ถูกบนหน้าจอเจอ').toBeGreaterThanOrEqual(0);
    await page.locator('.choice').nth(correctIndex).click();
  } else if (kind === 'fill') {
    const answer = await page.evaluate(() => {
      const norm = (s) => s.replace(/_+/g, '').replace(/\s+/g, '');
      const asked = norm(document.querySelector('.q-text').textContent);
      const found = window.EXAM.fill.find((q) => norm(q.q) === asked);
      return found ? found.accept[0] : null;
    });
    expect(answer, 'ต้องหาโจทย์เติมคำเจอในคลังข้อสอบ').not.toBeNull();
    await page.locator('.fill-input').fill(answer);
    await page.getByRole('button', { name: /^ตรวจคำตอบ/ }).click();
  } else {
    const answers = await page.evaluate(() => {
      const norm = (s) => s.replace(/\s+/g, '');
      const title = norm(document.querySelector('.q-text').textContent);
      const set = window.EXAM.matchSets.find((s) => norm(s.title) === title);
      return set ? set.items.map((i) => i.answer) : null;
    });
    expect(answers, 'ต้องหาชุดจับคู่เจอในคลังข้อสอบ').not.toBeNull();
    for (let i = 0; i < answers.length; i++) {
      await page.locator('.match-item').nth(i).locator('.slot').click();
      const wordIndex = await page.evaluate((want) => {
        const norm = (s) => s.replace(/\s+/g, '');
        return [...document.querySelectorAll('.word-pool .word')]
          .findIndex((node) => norm(node.textContent) === norm(want));
      }, answers[i]);
      expect(wordIndex, `ต้องหาคำ "${answers[i]}" ในกล่องคำเจอ`).toBeGreaterThanOrEqual(0);
      await page.locator('.word-pool .word').nth(wordIndex).click();
    }
    await page.getByRole('button', { name: /^ตรวจคำตอบ/ }).click();
  }

  await expect(page.locator('.feedback')).toBeVisible();
};

test('Exam A: คลังข้อสอบผ่านการตรวจความถูกต้อง และสุ่มออกมาได้ 60 ข้อครบ 3 ตอน', async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('/exam/');
  await expect(page.locator('#startBtn')).toBeEnabled();

  // ตัวตรวจในตัวของ bank.js ต้องไม่พบปัญหาเลย
  const problems = await page.evaluate(() => window.EXAM.validate());
  expect(problems, `คลังข้อสอบต้องไม่มีปัญหา: ${problems.join(', ')}`).toEqual([]);

  await expect(page.locator('#startBtn')).toHaveText('เริ่มทำข้อสอบ 60 ข้อ');

  await page.locator('#startBtn').click();
  await expect(page.locator('#progressLabel')).toHaveText('ข้อ 1 / 60');
  await expect(page.locator('#sectionBadge')).toContainText('ปรนัย');

  expect(errors, 'ต้องไม่มี pageerror').toHaveLength(0);
});

test('Exam B: ตอบถูกทุกข้อจนจบ ต้องได้ 60/60 และประวัติถูกบันทึก', async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('/exam/');
  await page.locator('#startBtn').click();
  await expect(page.locator('#screen-quiz')).toBeVisible();

  const seen = { mc: 0, match: 0, fill: 0 };
  for (let guard = 0; guard < 80; guard++) {
    seen[await currentKind(page)] += 1;
    await answerCurrentCorrectly(page);
    await page.locator('#nextBtn').click();
    if (await page.locator('#screen-result').isVisible()) break;
  }

  expect(seen, 'ต้องเจอครบทั้ง 40 ปรนัย, 2 ชุดจับคู่ และ 10 เติมคำ')
    .toEqual({ mc: 40, match: 2, fill: 10 });

  await expect(page.locator('#screen-result')).toBeVisible();
  await expect(page.locator('.score-big')).toHaveText('60 / 60');
  await expect(page.locator('.grade')).toHaveText('ยอดเยี่ยม (A)');

  // ประวัติต้องถูกบันทึกลง localStorage
  const history = await page.evaluate(() => JSON.parse(localStorage.getItem('examApp.history.v1') || '[]'));
  expect(history).toHaveLength(1);
  expect(history[0]).toMatchObject({ score: 60, total: 60, percent: 100 });

  // หน้าทบทวนต้องมีครบ 60 ข้อ และกรอง "ที่ตอบผิด" ต้องว่าง
  await page.getByRole('button', { name: 'ทบทวนคำตอบทั้งหมด' }).click();
  await expect(page.locator('.review-item')).toHaveCount(60);
  await page.locator('.seg-btn[data-filter="wrong"]').click();
  await expect(page.locator('#reviewHost')).toContainText('ไม่มีข้อที่ตอบผิด');

  expect(errors, 'ต้องไม่มี pageerror').toHaveLength(0);
});

test('Exam C: ตอบผิดแล้วต้องเฉลยทันที และเลือกบทเดียวได้', async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('/exam/');

  // เลือกบทที่ 5 บทเดียว
  await page.locator('#clearAllBtn').click();
  await expect(page.locator('#startBtn')).toBeDisabled();
  await page.locator('.chip', { hasText: 'บทที่ 5' }).click();
  await expect(page.locator('#startBtn')).toBeEnabled();
  await page.locator('#startBtn').click();

  // ทุกข้อในรอบนี้ต้องมาจากบทที่ 5 เท่านั้น
  await expect(page.locator('.q-meta .tag').first()).toHaveText('บทที่ 5');

  // จงใจตอบผิด แล้วต้องเห็นเฉลยพร้อมคำอธิบายทันที
  // (ตัวเลือกถูกสลับลำดับ จึงต้องหาข้อที่ผิดจาก "ข้อความ" ไม่ใช่ index ในคลัง)
  const wrongIndex = await page.evaluate(() => {
    const norm = (s) => s.replace(/_+/g, '').replace(/\s+/g, '');
    const asked = norm(document.querySelector('.q-text').textContent);
    const found = window.EXAM.mc.find((q) => norm(q.q) === asked);
    const correctText = norm(found.choices[found.answer]);
    const shown = [...document.querySelectorAll('.choice .choice-text')].map((n) => norm(n.textContent));
    return shown.findIndex((text) => text !== correctText);
  });
  expect(wrongIndex, 'ต้องมีตัวเลือกที่ผิดให้กดอย่างน้อย 1 ข้อ').toBeGreaterThanOrEqual(0);
  await page.locator('.choice').nth(wrongIndex).click();

  await expect(page.locator('.feedback.bad')).toBeVisible();
  await expect(page.locator('.feedback-head')).toContainText('คำตอบที่ถูกคือ');
  await expect(page.locator('.feedback-ref')).toContainText('ที่มา:');
  await expect(page.locator('.choice.is-correct')).toHaveCount(1);
  await expect(page.locator('.choice.is-wrong')).toHaveCount(1);
  await expect(page.locator('#liveScore')).toHaveText('คะแนน 0');

  expect(errors, 'ต้องไม่มี pageerror').toHaveLength(0);
});

test('Exam D: ออกกลางคันแล้วกลับมาทำต่อได้ แม้จะรีโหลดหน้า', async ({ page }) => {
  await page.goto('/exam/');
  await page.locator('#startBtn').click();

  await answerCurrentCorrectly(page);
  await page.locator('#nextBtn').click();
  await expect(page.locator('#progressLabel')).toHaveText('ข้อ 2 / 60');

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#quitBtn').click();
  await expect(page.locator('#screen-home')).toBeVisible();
  await expect(page.locator('#resumeCard')).toBeVisible();

  await page.reload();
  await expect(page.locator('#resumeInfo')).toContainText('ถึงข้อ 2 จาก 60 ข้อ');

  await page.locator('#resumeBtn').click();
  await expect(page.locator('#progressLabel')).toHaveText('ข้อ 2 / 60');
});

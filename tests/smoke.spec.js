import { test, expect } from '@playwright/test';

// ============================================
// Smoke tests — รันกับ production build (npm run preview)
// โหมด localStorage (ไม่มี Firebase env) — พฤติกรรมต้องเหมือนไฟล์ต้นฉบับ
// ============================================

// รายชื่อเมนู sidebar ทั้งหมด (ตรงกับ NAV ใน src/shell/chrome.jsx)
const NAV_LABELS = [
  'หน้าแรก', 'กล่องงาน', 'ข้อมูลเชิงลึก',
  'คำขอที่ส่ง', 'ผลงาน', 'แม่แบบ', 'คำขอประจำ', 'ปฏิทิน',
  'รออนุมัติ', 'รอรับเรื่อง', 'เคลียร์เอกสาร',
  'รายงานผู้บริหาร', 'สต๊อก', 'ข้อมูลหลัก', 'บันทึกกิจกรรม',
  'ตั้งค่า',
];

// เตรียมทุกเทสต์: ปิด onboarding card (กันบังเมนูล่างของ sidebar)
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fd-onboarding.seen', 'true');
  });
});

const collectPageErrors = (page) => {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err));
  return errors;
};

const login = async (page, userId) => {
  await page.goto('/');
  await page.waitForSelector('select.select', { timeout: 15_000 });
  await page.selectOption('select.select', userId);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 15_000 });
};

test('Test A: login ผู้ดูแล (ACC-004) แล้วเปิดทุกหน้า — ต้องไม่มี pageerror เลย', async ({ page }) => {
  const errors = collectPageErrors(page);

  await login(page, 'ACC-004'); // ผู้อำนวยการบัญชี = admin เห็นทุกเมนู

  for (const label of NAV_LABELS) {
    const item = page.locator('.sidebar .nav-item', { hasText: label }).first();
    await expect(item, `เมนู "${label}" ต้องปรากฏใน sidebar`).toBeVisible();
    await item.click();
    // ให้ React render + effects วิ่งจนจบ
    await page.waitForTimeout(300);
    expect(
      errors,
      `pageerror หลังเปิดหน้า "${label}":\n${errors.map((e) => e.stack || String(e)).join('\n---\n')}`
    ).toHaveLength(0);
  }

  // ท้ายสุด: ตรวจว่า state ยังอยู่ (localStorage autosave ทำงาน)
  const persisted = await page.evaluate(() => localStorage.getItem('fd-app-state'));
  expect(persisted, 'fd-app-state ต้องถูกเขียนลง localStorage').toBeTruthy();
  const parsed = JSON.parse(persisted);
  expect(Object.keys(parsed.users || {}).length).toBeGreaterThan(10);
});

test('Test B: สร้างคำขอ → เปิด detail → สลับผู้ใช้เป็นผู้อนุมัติ → อนุมัติ step แรก', async ({ page }) => {
  const errors = collectPageErrors(page);
  const TITLE = 'ทดสอบระบบอัตโนมัติ E2E';

  // ── 1) login เป็นพนักงานการตลาด แล้วสร้างคำขอ "อนุมัติทั่วไป" ──
  await login(page, 'MKT-002');
  // desktop ใช้ปุ่ม "สร้างคำขอ" บน TopBar (.fab แสดงเฉพาะจอมือถือ)
  await page.getByRole('button', { name: 'สร้างคำขอ', exact: true }).click();
  await expect(page.getByText('สร้างคำขอใหม่').first()).toBeVisible();
  await page.getByRole('button', { name: /อนุมัติทั่วไป/ }).click();

  // step กรอกข้อมูล — dueDate ถูกเติมอัตโนมัติโดย suggestDueDate อยู่แล้ว
  await page.getByPlaceholder('ระบุหัวข้อคำขอ').fill(TITLE);
  await page.getByPlaceholder('อธิบายเหตุผลและความจำเป็น...').fill('ทดสอบวัตถุประสงค์ของระบบอัตโนมัติ ยาวเกินสิบตัวอักษร');
  await page.getByRole('button', { name: 'ดำเนินการต่อ' }).click();

  // step ตรวจสอบ → ส่ง
  await page.getByRole('button', { name: 'ส่งคำขอ' }).click();

  // submit แล้ว app นำทางเข้า detail ของคำขอใหม่ทันที
  await expect(page.getByText(TITLE).first()).toBeVisible({ timeout: 10_000 });

  // ── 2) อ่าน request + ผู้อนุมัติ step แรก จาก localStorage ──
  const { reqId, approverId } = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('fd-app-state'));
    const r = s.requests[0];
    const step = r.flow[0];
    return { reqId: r.id, approverId: step.userId || (step.userIds && step.userIds[0]) };
  });
  expect(reqId).toMatch(/^GN-/);
  expect(approverId, 'flow step แรกต้องมีผู้อนุมัติ').toBeTruthy();

  // ── 3) สลับผู้ใช้เป็นผู้อนุมัติ ──
  await page.evaluate(() => window.__fdLogout());
  await page.waitForSelector('select.select', { timeout: 15_000 });
  await page.selectOption('select.select', approverId);
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await expect(page.locator('.sidebar')).toBeVisible({ timeout: 15_000 });

  // ── 4) เปิดหน้ารออนุมัติ → เข้าคำขอ → อนุมัติ ──
  await page.locator('.sidebar .nav-item', { hasText: 'รออนุมัติ' }).first().click();
  await page.getByText(TITLE).first().click();
  await page.getByRole('button', { name: 'อนุมัติ', exact: true }).click();
  await page.getByRole('button', { name: 'ยืนยันอนุมัติ' }).click();

  // ── 5) ตรวจผล: step แรกใน state เปลี่ยนเป็น approved ──
  await expect
    .poll(async () => page.evaluate((id) => {
      const s = JSON.parse(localStorage.getItem('fd-app-state'));
      const r = s.requests.find((x) => x.id === id);
      return r && r.flow[0].status;
    }, reqId), { timeout: 10_000 })
    .toBe('approved');

  expect(
    errors,
    `pageerror ระหว่าง Test B:\n${errors.map((e) => e.stack || String(e)).join('\n---\n')}`
  ).toHaveLength(0);
});

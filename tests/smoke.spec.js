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

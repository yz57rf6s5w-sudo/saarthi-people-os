const { test, expect } = require('@playwright/test');

async function login(page, role, name = 'QA Demo') {
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#loginName').fill(name);
  await page.locator('#loginRole').selectOption(role);
  await page.locator('#demoCode').fill('demo123');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page.locator('#app')).toBeVisible();
}

test('all five demo roles can log in and see their workspace', async ({ page }) => {
  for (const [role, heading] of [
    ['founder', 'Executive Dashboard'],
    ['hr', 'People Ops Hub'],
    ['manager', 'Team Dashboard'],
    ['employee', 'My Workspace'],
    ['candidate', 'Application Status'],
  ]) {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await login(page, role, 'Role QA');
    if (role === 'candidate') {
      await expect(page.locator('#mainContent')).toContainText('Application Status');
    } else {
      await expect(page.locator('#mainContent')).toContainText(heading);
    }
    await page.locator('#logoutBtn').click();
    await expect(page.locator('#loginScreen')).toBeVisible();
  }
});

test('employee can submit a leave request and see it in the list', async ({ page }) => {
  await login(page, 'employee', 'Leave QA');
  await page.getByRole('button', { name: /My Leaves/ }).click();
  await page.getByRole('button', { name: /Apply leave/ }).click();
  await page.locator('#modalContent [name="type"]').selectOption({ label: 'Casual Leave' });
  await page.locator('#modalContent [name="days"]').fill('2');
  await page.locator('#modalContent [name="date"]').fill('2026-11-12');
  await page.locator('#modalContent [name="reason"]').fill('Automated test request');
  await page.locator('#modalOk').click();
  await expect(page.locator('#leaveTable')).toContainText('Automated test request');
  await page.reload();
  await expect(page.locator('#loginScreen')).toBeVisible();
});

test('candidate can create a support ticket', async ({ page }) => {
  await login(page, 'candidate', 'Candidate QA');
  await page.getByRole('button', { name: /Candidate Support/ }).click();
  await page.getByRole('button', { name: /Raise ticket/ }).click();
  await page.locator('#modalContent [name="subject"]').fill('Automated candidate support test');
  await page.locator('#modalContent [name="priority"]').selectOption({ label: 'High' });
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Automated candidate support test');
});

test('employee helpdesk is scoped to the signed-in user', async ({ page }) => {
  await login(page, 'employee', 'Private QA Employee');
  await page.getByRole('button', { name: /HR Helpdesk/ }).click();
  await page.getByRole('button', { name: /Raise ticket/ }).click();
  await page.locator('#modalContent [name="subject"]').fill('Private QA ticket');
  await page.locator('#modalContent [name="priority"]').selectOption({ label: 'Medium' });
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Private QA ticket');
  await expect(page.locator('#mainContent')).toContainText('Private QA Employee');
  await expect(page.locator('#mainContent')).not.toContainText('Candidate QA');
});

test('expense form blocks zero-value claims', async ({ page }) => {
  await login(page, 'employee', 'Validation QA');
  await page.getByRole('button', { name: /My Expense Claims/ }).click();
  await page.getByRole('button', { name: /New claim/ }).click();
  await page.locator('#modalContent [name="category"]').selectOption({ label: 'Other' });
  await page.locator('#modalContent [name="amount"]').fill('0');
  await page.locator('#modalContent [name="desc"]').fill('Invalid zero-value claim');
  await page.locator('#modalOk').click();
  await expect(page.locator('#modalBg')).toBeVisible();
  await expect(page.locator('#mainContent')).not.toContainText('Invalid zero-value claim');
  await page.locator('#modalContent [name="amount"]').fill('100');
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Invalid zero-value claim');
});

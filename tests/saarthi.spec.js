const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function login(page, name, role) {
  await page.locator('#loginName').fill(name);
  await page.locator('#loginRole').selectOption(role);
  await page.locator('#demoCode').fill('demo123');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page.locator('#app')).not.toHaveClass(/hidden/);
}

test('login and role-specific dashboards render', async ({ page }) => {
  await login(page, 'E2E Founder', 'founder');
  await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible();
  await page.locator('#roleSelector').selectOption('manager');
  await expect(page.getByRole('heading', { name: 'Team Dashboard' })).toBeVisible();
  await page.locator('#roleSelector').selectOption('employee');
  await expect(page.getByRole('heading', { name: 'My Workspace' })).toBeVisible();
});

test('candidate can submit a support ticket', async ({ page }) => {
  await login(page, 'E2E Candidate', 'candidate');
  await expect(page.getByRole('heading', { name: 'Application Status' })).toBeVisible();
  await page.getByRole('button', { name: 'Contact candidate support' }).click();
  await page.locator('[name="subject"]').fill('E2E candidate question');
  await page.locator('#modalOk').click();
  await expect(page.getByText('E2E candidate question')).toBeVisible();
  const ticketRow = page.locator('tr').filter({ hasText: 'E2E candidate question' });
  await expect(ticketRow.getByText('Open', { exact: true })).toBeVisible();
});

test('employee leave request can be submitted and approved by founder', async ({ page }) => {
  await login(page, 'E2E Employee', 'employee');
  await page.getByRole('button', { name: 'My Leaves' }).click();
  await page.getByRole('button', { name: /Apply leave/ }).click();
  await page.locator('[name="type"]').selectOption({ label: 'Casual Leave' });
  await page.locator('[name="days"]').fill('1');
  await page.locator('[name="date"]').fill('2026-11-12');
  await page.locator('[name="reason"]').fill('E2E regression leave');
  await page.locator('#modalOk').click();
  await expect(page.getByText('E2E regression leave')).toBeVisible();
  await page.locator('#roleSelector').selectOption('founder');
  await page.getByRole('button', { name: 'Leave Approvals' }).click();
  const request = page.locator('tr').filter({ hasText: 'E2E regression leave' });
  await expect(request).toBeVisible();
  await request.getByRole('button', { name: 'Approve' }).click();
  await expect(request.getByText(/Approved/)).toBeVisible();
});

test('expense claim can be rejected by HR', async ({ page }) => {
  await login(page, 'E2E Employee', 'employee');
  await page.getByRole('button', { name: 'My Expense Claims' }).click();
  await page.getByRole('button', { name: /New claim/ }).click();
  await page.locator('[name="category"]').selectOption({ label: 'Other' });
  await page.locator('[name="amount"]').fill('450');
  await page.locator('[name="desc"]').fill('E2E regression expense');
  await page.locator('#modalOk').click();
  await page.locator('#roleSelector').selectOption('hr');
  await page.getByRole('button', { name: 'Reimbursements' }).click();
  const claim = page.locator('tr').filter({ hasText: 'E2E regression expense' });
  await expect(claim).toBeVisible();
  await claim.getByRole('button', { name: 'Reject' }).click();
  await expect(page.locator('#toast')).toContainText('Claim rejected');
  const updatedClaim = page.locator('tr').filter({ hasText: 'E2E regression expense' });
  await expect(updatedClaim).toContainText('Rejected');
});

test('employee sees only their own helpdesk tickets and cannot resolve them', async ({ page }) => {
  await login(page, 'E2E Employee', 'employee');
  await page.getByRole('button', { name: 'HR Helpdesk' }).click();
  await page.getByRole('button', { name: /Raise ticket/ }).click();
  await page.locator('[name="subject"]').fill('E2E private ticket');
  await page.locator('[name="priority"]').selectOption({ label: 'High' });
  await page.locator('#modalOk').click();
  await expect(page.getByText('E2E private ticket')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resolve' })).toHaveCount(0);
});

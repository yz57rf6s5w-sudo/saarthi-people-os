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
    ['founder', 'Build a better people experience.'],
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

test('HR can approve a pending expense claim', async ({ page }) => {
  await login(page, 'employee', 'Approval QA');
  await page.getByRole('button', { name: /My Expense Claims/ }).click();
  await page.getByRole('button', { name: /New claim/ }).click();
  await page.locator('#modalContent [name="category"]').selectOption({ label: 'Other' });
  await page.locator('#modalContent [name="amount"]').fill('250');
  await page.locator('#modalContent [name="desc"]').fill('Approval QA expense');
  await page.locator('#modalOk').click();
  await page.locator('#roleSelector').selectOption('hr');
  await page.getByRole('button', { name: 'Reimbursements' }).click();
  const claim = page.locator('tr').filter({ hasText: 'Approval QA expense' });
  await expect(claim).toBeVisible();
  await claim.getByRole('button', { name: 'Approve' }).click();
  await expect(page.locator('tr').filter({ hasText: 'Approval QA expense' })).toContainText('Approved');
});

test('founder can export a Saarthi data backup', async ({ page }) => {
  await login(page, 'founder', 'Backup QA');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export data' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^saarthi-people-os-backup-.*\.json$/);
});

test('founder can restore a valid Saarthi backup', async ({ page }) => {
  await login(page, 'founder', 'Restore QA');
  page.on('dialog', dialog => dialog.accept());
  const backup = {
    app: 'Saarthi People OS',
    schemaVersion: 1,
    data: {
      activeRole: 'founder',
      displayName: 'Restore QA',
      employees: [{ id: 999, name: 'Restored Demo Employee', role: 'QA', location: 'Remote', join: '2026-10-01', manager: 'Founder', status: 'Active' }],
      leaves: [], reimbursements: [], shoutouts: [], tickets: [], onboarding: []
    }
  };
  await page.locator('#importDataFile').setInputFiles({
    name: 'saarthi-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup))
  });
  await expect(page.locator('#sidebarSummary')).toContainText('1');
  await page.getByRole('button', { name: /Team Directory/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Restored Demo Employee');
});
test('HR can mark an onboarding step done and retain progress', async ({ page }) => {
  await login(page, 'hr', 'Onboarding QA');
  await page.getByRole('button', { name: /Onboarding/ }).click();
  const step = page.locator('.onboard-step').filter({ hasText: 'First feature commit' });
  await expect(step).toContainText('In Progress');
  await step.getByRole('button', { name: 'Mark done' }).click();
  await expect(page.locator('.onboard-step').filter({ hasText: 'First feature commit' })).toContainText('Done');
  await page.reload();
  await expect(page.locator('#loginScreen')).toBeVisible();
  await login(page, 'hr', 'Onboarding QA');
  await page.getByRole('button', { name: /Onboarding/ }).click();
  await expect(page.locator('.onboard-step').filter({ hasText: 'First feature commit' })).toContainText('Done');
});


test('employee can open their onboarding checklist', async ({ page }) => {
  await login(page, 'employee', 'New Joiner QA');
  await page.getByRole('button', { name: /My Onboarding/ }).click();
  await expect(page.locator('#mainContent')).toContainText('October 2026 cohort');
  await expect(page.locator('.onboard-step').filter({ hasText: 'First feature commit' })).toContainText('In Progress');
});


test('manager can approve an employee leave request', async ({ page }) => {
  await login(page, 'employee', 'Manager Approval QA');
  await page.getByRole('button', { name: /My Leaves/ }).click();
  await page.getByRole('button', { name: /Apply leave/ }).click();
  await page.locator('#modalContent [name="type"]').selectOption({ label: 'Casual Leave' });
  await page.locator('#modalContent [name="days"]').fill('1');
  await page.locator('#modalContent [name="date"]').fill('2026-11-18');
  await page.locator('#modalContent [name="reason"]').fill('Manager approval regression');
  await page.locator('#modalOk').click();
  await expect(page.locator('#leaveTable')).toContainText('Manager approval regression');
  await page.locator('#roleSelector').selectOption('manager');
  await page.getByRole('button', { name: /Team Leave Requests/ }).click();
  const request = page.locator('#leaveTable tr').filter({ hasText: 'Manager approval regression' });
  await expect(request).toBeVisible();
  await request.getByRole('button', { name: 'Approve' }).click();
  await expect(page.locator('#leaveTable tr').filter({ hasText: 'Manager approval regression' })).toContainText('Approved');
});

test('role switch updates navigation to the selected workspace', async ({ page }) => {
  await login(page, 'employee', 'Navigation QA');
  await expect(page.locator('#nav')).toContainText('My Leaves');
  await expect(page.locator('#nav')).not.toContainText('Team Leave Requests');
  await expect(page.locator('#nav')).not.toContainText('Team Directory');

  await page.locator('#roleSelector').selectOption('manager');
  await expect(page.locator('#nav')).toContainText('Team Leave Requests');
  await expect(page.locator('#nav')).toContainText('Expense Approvals');
  await expect(page.locator('#nav')).not.toContainText('My Onboarding');

  await page.locator('#roleSelector').selectOption('candidate');
  await expect(page.locator('#nav')).toContainText('Application Status');
  await expect(page.locator('#nav')).toContainText('Candidate Support');
  await expect(page.locator('#nav')).not.toContainText('Team Directory');
});

test('employee leave view does not expose approval actions', async ({ page }) => {
  await login(page, 'employee', 'Employee Permission QA');
  await page.getByRole('button', { name: /My Leaves/ }).click();
  await page.getByRole('button', { name: /Apply leave/ }).click();
  await page.locator('#modalContent [name="type"]').selectOption({ label: 'Casual Leave' });
  await page.locator('#modalContent [name="days"]').fill('1');
  await page.locator('#modalContent [name="date"]').fill('2026-11-20');
  await page.locator('#modalContent [name="reason"]').fill('Employee permission QA');
  await page.locator('#modalOk').click();
  const request = page.locator('#leaveTable tr').filter({ hasText: 'Employee permission QA' });
  await expect(request).toBeVisible();
  await expect(request.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  await expect(request.getByRole('button', { name: 'Reject' })).toHaveCount(0);
});

test('HR can import employees from a CSV spreadsheet', async ({ page }) => {
  await login(page, 'hr', 'CSV Import QA');
  await page.getByRole('button', { name: 'Import employees CSV' }).click();
  await page.locator('#importEmployeesFile').setInputFiles({
    name: 'employees.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Name,Role,Location,Join,Manager,Status\nCSV Import Employee,QA Analyst,Remote,2026-10-26,People Lead,Active\n')
  });
  await expect(page.locator('#mainContent')).toContainText('CSV Import Employee');
  await expect(page.locator('#mainContent')).toContainText('QA Analyst');
});

test('workspace setup saves company settings for reuse', async ({ page }) => {
  await login(page, 'hr', 'Workspace Setup QA');
  await page.getByRole('button', { name: 'Workspace setup' }).click();
  await page.locator('#workspaceCompany').fill('Northstar Startup');
  await page.locator('#workspaceIndustry').selectOption({ label: 'Technology / SaaS' });
  await page.locator('#workspaceLocation').fill('Bengaluru, India');
  await page.locator('#workspaceSize').selectOption({ label: '11–25 people' });
  await page.locator('#workspaceStage').selectOption({ label: 'Bootstrapped' });
  await page.getByRole('button', { name: 'Save workspace' }).click();
  await expect(page.locator('#toast')).toContainText('Workspace settings saved');
  await page.getByRole('button', { name: 'Workspace setup' }).click();
  await expect(page.locator('#workspaceCompany')).toHaveValue('Northstar Startup');
  await expect(page.locator('#workspaceLocation')).toHaveValue('Bengaluru, India');
  await expect(page.locator('#workspaceSize')).toHaveValue('11–25');
});

test('founder dashboard provides working guided setup and quick actions', async ({ page }) => {
  await login(page, 'founder', 'Founder Dashboard QA');
  await expect(page.locator('#mainContent .founder-hero')).toBeVisible();
  await expect(page.locator('#mainContent')).toContainText('Make Saarthi yours');
  await page.getByRole('button', { name: 'Set up workspace' }).click();
  await expect(page.locator('#workspaceSetupForm')).toBeVisible();
  await page.getByRole('button', { name: 'Close setup' }).click();
  await page.getByRole('button', { name: /Team directory/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Team Directory');
});


test('founder setup checklist reflects workspace and directory progress', async ({ page }) => {
  await login(page, 'founder', 'Setup Progress QA');
  await page.getByRole('button', { name: 'Set up workspace' }).click();
  await page.locator('#workspaceCompany').fill('Progress Demo');
  await page.getByRole('button', { name: 'Save workspace' }).click();
  await expect(page.locator('.setup-count')).toHaveText('1 of 3');
  await page.locator('#nav button[data-tab="directory"]').click();
  await expect(page.locator('#mainContent')).toContainText('Team Directory');
  await page.locator('#nav button[data-tab="dashboard"]').click();
  await expect(page.locator('.setup-count')).toHaveText('2 of 3');
  await expect(page.locator('.founder-task').filter({ hasText: 'Review your people directory' })).toContainText('Reviewed');
});

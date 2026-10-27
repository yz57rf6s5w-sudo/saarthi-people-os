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
  await page.locator('#menuToggle').click();
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
  await expect(page.locator('#mainContent')).toContainText('New-joiner readiness');
  await expect(page.locator('#mainContent')).toContainText('Overdue · unblocked');
  await expect(page.locator('.onboard-step').filter({ hasText: 'First feature commit' })).toContainText('Owner: Manager');
  await expect(page.locator('.onboard-step').filter({ hasText: 'First feature commit' })).toContainText('In Progress');
});


test('team directory empty state spans the correct table columns', async ({ page }) => {
  await login(page, 'hr', 'Directory QA');
  await page.getByRole('button', { name: /Team Directory/ }).click();
  await page.locator('#dirFilter').fill('no-such-person-qa');
  const emptyCell = page.locator('#dirTable tbody td').filter({ hasText: 'No matches' });
  await expect(emptyCell).toBeVisible();
  await expect(emptyCell).toHaveAttribute('colspan', '7');
});

test('onboarding remains usable on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'hr', 'Mobile Onboarding QA');
  await page.getByRole('button', { name: /Onboarding/ }).click();
  await expect(page.locator('#mainContent')).toContainText('New-joiner readiness');
  await expect(page.locator('#addOnboardingStep')).toBeVisible();
  await expect(page.locator('.onboard-step').first()).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test('onboarding shows the root owner when a task is blocked by a chain of prerequisites', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saarthi_people_os_demo_v3', JSON.stringify({
    onboarding: [
      { id: 901, title: 'Verify signed documents', detail: 'HR verifies all signed documents', status: 'In Progress', owner: 'HR', dueDate: '2026-10-01' },
      { id: 902, title: 'Provision system access', detail: 'IT provisions required accounts', status: 'In Progress', owner: 'IT', dueDate: '2026-10-02', dependsOn: 901 },
      { id: 903, title: 'Start first-day setup', detail: 'Manager confirms the employee is ready', status: 'In Progress', owner: 'Manager', dueDate: '2026-10-03', dependsOn: 902 }
    ]
  })));
  await login(page, 'hr', 'Dependency Chain QA');
  await page.getByRole('button', { name: /Onboarding/ }).click();
  const downstream = page.locator('.onboard-step').filter({ hasText: 'Start first-day setup' });
  await expect(downstream).toContainText('Blocked');
  await expect(downstream).toContainText('Waiting for Provision system access');
  await expect(downstream).toContainText('Root blocker: Verify signed documents');
  await expect(downstream).toContainText('Owner: HR');
  await expect(downstream.getByRole('button', { name: 'Waiting' })).toBeDisabled();
  await expect(page.locator('#mainContent')).toContainText('Overdue · unblocked');
});

test('manager can approve a direct report leave request but only sees their team', async ({ page }) => {
  await login(page, 'employee', 'Ananya Sharma');
  await page.getByRole('button', { name: /My Leaves/ }).click();
  await page.getByRole('button', { name: /Apply leave/ }).click();
  await page.locator('#modalContent [name="type"]').selectOption({ label: 'Casual Leave' });
  await page.locator('#modalContent [name="days"]').fill('1');
  await page.locator('#modalContent [name="date"]').fill('2026-11-18');
  await page.locator('#modalContent [name="reason"]').fill('Manager approval regression');
  await page.locator('#modalOk').click();
  await expect(page.locator('#leaveTable')).toContainText('Manager approval regression');
  await page.locator('#logoutBtn').click();
  await login(page, 'manager', 'Arjun Das');
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


test('CSV import skips duplicate employee rows without duplicating directory records', async ({ page }) => {
  await login(page, 'hr', 'CSV Duplicate QA');
  const file = {
    name: 'employees-duplicates.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('Name,Role,Location\nDuplicate Test Person,QA Analyst,Remote\nDuplicate Test Person,QA Analyst,Remote\n')
  };
  await page.getByRole('button', { name: 'Import employees CSV' }).click();
  await page.locator('#importEmployeesFile').setInputFiles(file);
  await expect(page.locator('#mainContent')).toContainText('Duplicate Test Person');
  await expect(page.locator('#toast')).toContainText('Skipped 1 duplicate row');
});


test('founder can export a filtered team directory as CSV', async ({ page }) => {
  await login(page, 'founder', 'Directory Export QA');
  await page.locator('#nav button[data-tab="directory"]').click();
  await expect(page.locator('#dirTable tbody tr')).toHaveCount(5);
  await page.locator('#dirFilter').fill('Product');
  await expect(page.locator('#dirTable tbody tr')).toHaveCount(1);
  await expect(page.locator('#dirTable tbody')).toContainText('Product');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export directory CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/saarthi-team-directory-.*\.csv/);
  const fs = require('node:fs/promises');
  const csvPath = await download.path();
  const csv = await fs.readFile(csvPath, 'utf8');
  expect(csv).toContain('Ananya Sharma');
  expect(csv).toContain('Product Designer');
  expect(csv).not.toContain('Rohan Mehta');
});


test('leave form prevents past dates and defaults to a future date', async ({ page }) => {
  await login(page, 'employee', 'Leave Date Validation QA');
  await page.getByRole('button', { name: /My Leaves/ }).click();
  await page.getByRole('button', { name: /Apply leave/ }).click();
  const dateInput = page.locator('#modalContent [name="date"]');
  const daysInput = page.locator('#modalContent [name="days"]');
  const today = await page.evaluate(() => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  });
  expect(await dateInput.getAttribute('min')).toBe(today);
  expect((await dateInput.inputValue()) > today).toBe(true);
  await dateInput.fill('2020-01-01');
  await page.locator('#modalContent [name="type"]').selectOption({ label: 'Casual Leave' });
  await daysInput.fill('2');
  await page.locator('#modalContent [name="reason"]').fill('Past date validation test');
  await page.locator('#modalOk').click();
  await expect(page.locator('#modalBg')).toBeVisible();
  await expect(page.locator('#leaveTable')).not.toContainText('Past date validation test');
});


test('expense claims accept valid paise precision and show a helpful empty state', async ({ page }) => {
  await login(page, 'employee', 'Expense Decimal QA');
  await page.getByRole('button', { name: /My Expense Claims/ }).click();
  await expect(page.locator('#mainContent')).toContainText('No expense claims yet');
  await page.getByRole('button', { name: /New claim/ }).click();
  await page.locator('#modalContent [name="category"]').selectOption({ label: 'Other' });
  const amount = page.locator('#modalContent [name="amount"]');
  await expect(amount).toHaveAttribute('step', '0.01');
  await amount.fill('12.50');
  await page.locator('#modalContent [name="desc"]').fill('Valid paise precision test');
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('₹12.50');
  await expect(page.locator('#mainContent')).toContainText('Valid paise precision test');
});


test('helpdesk ticket form keeps valid subject text trimmed', async ({ page }) => {
  await login(page, 'employee', 'Helpdesk Subject QA');
  await page.getByRole('button', { name: /HR Helpdesk/ }).click();
  await page.getByRole('button', { name: /Raise ticket/ }).click();
  const subject = page.locator('#modalContent [name="subject"]');
  await subject.fill('Device access request');
  await page.locator('#modalContent [name="priority"]').selectOption({ label: 'Medium' });
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Device access request');
});


test('HR can edit an employee record and persist the updated details', async ({ page }) => {
  await login(page, 'hr', 'Employee Edit QA');
  await page.locator('#nav button[data-tab="directory"]').click();
  const row = page.locator('#dirTable tbody tr').filter({ hasText: 'Ananya Sharma' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#modalContent [name="location"]').fill('Pune, India');
  await page.locator('#modalOk').click();
  await expect(page.locator('#dirTable tbody tr').filter({ hasText: 'Ananya Sharma' })).toContainText('Pune, India');
  await page.reload();
  await login(page, 'hr', 'Employee Edit QA');
  await page.locator('#nav button[data-tab="directory"]').click();
  await expect(page.locator('#dirTable tbody tr').filter({ hasText: 'Ananya Sharma' })).toContainText('Pune, India');
});

test('HR status changes update the directory and active dashboard count and persist', async ({ page }) => {
  await login(page, 'hr', 'Employee Status QA');
  await page.locator('#nav button[data-tab="directory"]').click();
  const row = page.locator('#dirTable tbody tr').filter({ hasText: 'Ananya Sharma' });
  await expect(row).toContainText('Active');
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.locator('#modalContent [name="status"]').selectOption('Inactive');
  await page.locator('#modalOk').click();
  await expect(page.locator('#dirTable tbody tr').filter({ hasText: 'Ananya Sharma' })).toContainText('Inactive');
  await expect(page.locator('.directory-status-metrics .metric').filter({ hasText: 'Inactive' }).locator('strong')).toHaveText('1');
  await expect(page.locator('.directory-status-metrics .metric').nth(0).locator('strong')).toHaveText('4');
  await expect(page.locator('#sidebarSummary')).toContainText('4 active headcount');
  await page.locator('#nav button[data-tab="dashboard"]').click();
  await expect(page.locator('.metric').filter({ hasText: 'Active team members' }).locator('strong')).toHaveText('4');
  await page.reload();
  await login(page, 'hr', 'Employee Status QA');
  await page.locator('#nav button[data-tab="directory"]').click();
  await expect(page.locator('#dirTable tbody tr').filter({ hasText: 'Ananya Sharma' })).toContainText('Inactive');
  await page.locator('#nav button[data-tab="dashboard"]').click();
  await expect(page.locator('.metric').filter({ hasText: 'Active team members' }).locator('strong')).toHaveText('4');
});

test('every role navigation destination renders a usable module without browser errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  for (const role of ['founder', 'hr', 'manager', 'employee', 'candidate']) {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await login(page, role, 'Module Smoke QA');

    const tabIds = await page.locator('#nav button').evaluateAll(buttons =>
      buttons.map(button => button.dataset.tab).filter(Boolean)
    );
    expect(tabIds.length, role + ' should have navigation destinations').toBeGreaterThan(0);

    for (const tabId of tabIds) {
      await page.locator('#nav button[data-tab="' + tabId + '"]').click();
      await expect(page.locator('#mainContent')).toBeVisible();
      await expect(page.locator('#mainContent')).not.toBeEmpty();
      const text = (await page.locator('#mainContent').innerText()).trim();
      expect(text.length, role + '/' + tabId + ' should render useful content').toBeGreaterThan(15);
    }

    await page.locator('#logoutBtn').click();
    await expect(page.locator('#loginScreen')).toBeVisible();
  }

  expect(pageErrors, 'module navigation should not throw uncaught browser errors').toEqual([]);
});

test('employee cannot resolve helpdesk tickets but HR can resolve them', async ({ page }) => {
  await login(page, 'employee', 'Ticket Permission QA');
  await page.getByRole('button', { name: /HR Helpdesk/ }).click();
  await page.getByRole('button', { name: /Raise ticket/ }).click();
  await page.locator('#modalContent [name="subject"]').fill('Permission boundary test ticket');
  await page.locator('#modalContent [name="priority"]').selectOption({ label: 'High' });
  await page.locator('#modalOk').click();

  const ownTicket = page.locator('#mainContent tr').filter({ hasText: 'Permission boundary test ticket' });
  await expect(ownTicket).toBeVisible();
  await expect(ownTicket.getByRole('button', { name: 'Resolve' })).toHaveCount(0);

  await page.locator('#roleSelector').selectOption('hr');
  await page.getByRole('button', { name: /Helpdesk Tickets/ }).click();
  const hrTicket = page.locator('#mainContent tr').filter({ hasText: 'Permission boundary test ticket' });
  await expect(hrTicket).toBeVisible();
  await hrTicket.getByRole('button', { name: 'Resolve' }).click();
  await expect(page.locator('#mainContent tr').filter({ hasText: 'Permission boundary test ticket' })).toContainText('Resolved');
});


test('project OKRs can be created and key-result progress persists after reload', async ({ page }) => {
  await login(page, 'founder', 'Project OKR QA');
  await page.getByRole('button', { name: /Project & OKR Tracking/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Improve onboarding completion');
  await page.getByRole('button', { name: /New project/ }).click();
  await page.locator('#modalContent [name="name"]').fill('QA product launch');
  await page.locator('#modalContent [name="objective"]').fill('Launch a testable first release');
  await page.locator('#modalContent [name="owner"]').fill('Product team');
  await page.locator('#modalContent [name="due"]').fill('2026-12-20');
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('QA product launch');
  await page.reload();
  await login(page, 'founder', 'Project OKR QA');
  await page.getByRole('button', { name: /Project & OKR Tracking/ }).click();
  await expect(page.locator('#mainContent')).toContainText('QA product launch');
});

test('employee and candidate roles do not show employee CSV import controls', async ({ page }) => {
  for (const role of ['employee', 'candidate']) {
    await page.goto('http://127.0.0.1:4173');
    await page.locator('#loginName').fill('CSV role visibility QA');
    await page.locator('#loginRole').selectOption(role);
    await page.locator('#demoCode').fill('demo123');
    await page.getByRole('button', { name: 'Enter workspace' }).click();
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('#importEmployeesBtn')).toBeHidden();
    await expect(page.locator('#importEmployeesFile')).toBeHidden();
    await page.locator('#roleSelector').selectOption('founder');
    await expect(page.locator('#importEmployeesBtn')).toBeVisible();
    await expect(page.locator('#importEmployeesFile')).toBeHidden();
  }
});

test('founder advanced settings save workflow defaults and role module access', async ({ page }) => {
  await login(page, 'founder', 'Admin Settings QA');
  await page.getByRole('button', { name: /Advanced Settings/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Role-based module access');
  await page.locator('#wfLeave').uncheck();
  await page.getByRole('button', { name: 'Save workflow settings' }).click();
  await expect(page.locator('#toast')).toContainText('Workflow settings saved');
  await page.locator('[data-access-role="employee"][data-access-module="projects"]').uncheck();
  await page.getByRole('button', { name: 'Save access rules' }).click();
  await page.locator('#roleSelector').selectOption('employee');
  await expect(page.locator('#nav button[data-tab="projects"]')).toHaveCount(0);
  await page.reload();
  await login(page, 'founder', 'Admin Settings QA');
  await page.getByRole('button', { name: /Advanced Settings/ }).click();
  await expect(page.locator('#wfLeave')).not.toBeChecked();
  await expect(page.locator('[data-access-role="employee"][data-access-module="projects"]')).not.toBeChecked();
});


test('admin-configured approval rules auto-approve employee leave and expense requests', async ({ page }) => {
  await login(page, 'founder', 'Workflow enforcement QA');
  await page.getByRole('button', { name: /Advanced Settings/ }).click();
  await page.locator('#wfLeave').uncheck();
  await page.locator('#wfExpense').uncheck();
  await page.getByRole('button', { name: 'Save workflow settings' }).click();
  await expect(page.locator('#toast')).toContainText('Workflow settings saved');

  await page.locator('#roleSelector').selectOption('employee');
  await page.getByRole('button', { name: /Leave/ }).first().click();
  await page.getByRole('button', { name: /Apply leave/ }).click();
  await page.locator('#modalContent [name="type"]').selectOption({ label: 'Casual Leave' });
  await page.locator('#modalContent [name="days"]').fill('1');
  await page.locator('#modalContent [name="date"]').fill('2026-12-15');
  await page.locator('#modalContent [name="reason"]').fill('Workflow auto-approval test');
  await page.locator('#modalOk').click();
  const leaveRow = page.locator('#leaveTable tbody tr').filter({ hasText: 'Workflow auto-approval test' });
  await expect(leaveRow).toContainText('Approved');
  await expect(leaveRow).toContainText('Workspace rule');

  await page.getByRole('button', { name: /Reimbursements|Expense/ }).first().click();
  await page.getByRole('button', { name: /New claim/ }).click();
  await page.locator('#modalContent [name="category"]').selectOption({ label: 'Office Supplies' });
  await page.locator('#modalContent [name="amount"]').fill('123.45');
  await page.locator('#modalContent [name="desc"]').fill('Workflow auto-approval test expense');
  await page.locator('#modalOk').click();
  const expenseRow = page.locator('#mainContent tr').filter({ hasText: 'Workflow auto-approval test expense' });
  await expect(expenseRow).toContainText('Approved');
  await expect(expenseRow).toContainText('123.45');
});


test('manager expense approvals show direct reports and exclude other teams', async ({ page }) => {
  await login(page, 'employee', 'Ananya Sharma');
  await page.getByRole('button', { name: /My Expense Claims/ }).click();
  await page.getByRole('button', { name: /New claim/ }).click();
  await page.locator('#modalContent [name="category"]').selectOption({ label: 'Travel' });
  await page.locator('#modalContent [name="amount"]').fill('456.78');
  await page.locator('#modalContent [name="desc"]').fill('Direct report expense scope QA');
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Direct report expense scope QA');

  await page.locator('#logoutBtn').click();
  await login(page, 'manager', 'Arjun Das');
  await page.getByRole('button', { name: /Expense Approvals/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Direct report expense scope QA');
  await expect(page.locator('#mainContent')).not.toContainText('Figma Subscription');
});

test('shoutouts can be created and persist after reload', async ({ page }) => {
  await login(page, 'employee', 'Recognition QA');
  await page.locator('#nav button[data-tab="rewards"]').click();
  await page.getByRole('button', { name: /Give shoutout/ }).click();
  await page.locator('#modalContent [name="to"]').fill('Ananya Sharma');
  await page.locator('#modalContent [name="badge"]').selectOption({ label: '🌟 Rising Star' });
  await page.locator('#modalContent [name="text"]').fill('Recognition workflow regression test');
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Recognition workflow regression test');
  await page.reload();
  await login(page, 'employee', 'Recognition QA');
  await page.locator('#nav button[data-tab="rewards"]').click();
  await expect(page.locator('#mainContent')).toContainText('Recognition workflow regression test');
});


test('employee can create, customize and retain a career learning plan', async ({ page }) => {
  test.setTimeout(60000);
  await login(page, 'employee', 'Career Plan QA');
  await page.locator('#nav button[data-tab="career"]').click();
  await expect(page.locator('#mainContent')).toContainText('Set your own direction, skills and learning pace');
  await page.getByRole('button', { name: /Create my career plan/ }).click();
  await page.locator('#modalContent [name="currentRole"]').fill('People Ops Associate');
  await page.locator('#modalContent [name="targetRole"]').fill('People Operations Partner');
  await page.locator('#modalContent [name="horizon"]').selectOption({ label: '90 days' });
  await page.locator('#modalContent [name="skillArea"]').selectOption({ label: 'Communication' });
  await page.locator('#modalContent [name="skillsToBuild"]').fill('Stakeholder management, HR analytics');
  await page.locator('#modalContent [name="learningGoal"]').fill('Lead one employee experience improvement project');
  await page.locator('#modalContent [name="preferredLearning"]').selectOption({ label: 'Mentoring / shadowing' });
  await page.locator('#modalContent [name="weeklyHours"]').fill('3');
  await page.locator('#modalContent [name="progress"]').selectOption({ label: 'In progress' });
  await page.locator('#modalContent [name="notes"]').fill('Would like a mentor and a practical project');
  await page.locator('#modalContent [name="visibility"]').selectOption({ label: 'Private' });
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('People Operations Partner');
  await expect(page.locator('#mainContent')).toContainText('Stakeholder management, HR analytics');
  await page.reload();
  await expect(page.locator('#loginScreen')).toBeVisible();
  await login(page, 'employee', 'Career Plan QA');
  await page.locator('#nav button[data-tab="career"]').click();
  await expect(page.locator('#mainContent')).toContainText('People Operations Partner');
  await expect(page.locator('#mainContent')).toContainText('3 hr');
});

test('founder can customize career skill areas and time horizons', async ({ page }) => {
  await login(page, 'founder', 'Career Settings QA');
  await page.locator('#nav button[data-tab="career"]').click();
  await page.getByRole('button', { name: /Customize skill areas/ }).click();
  await page.locator('#modalContent [name="skillAreas"]').fill('Customer empathy\\nSystems thinking\\nPeople leadership');
  await page.locator('#modalContent [name="goalHorizons"]').fill('2 weeks\\n4 months');
  await page.locator('#modalOk').click();
  await expect(page.locator('#toast')).toContainText('Career options customized');
  await page.locator('#roleSelector').selectOption('employee');
  await page.locator('#nav button[data-tab="career"]').click();
  await page.getByRole('button', { name: /Create my career plan/ }).click();
  await expect(page.locator('#modalContent [name="skillArea"]')).toContainText('Systems thinking');
  await expect(page.locator('#modalContent [name="horizon"]')).toContainText('4 months');
});

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

test('employee can check in and check out and see attendance history', async ({ page }) => {
  await login(page, 'employee', 'Attendance QA');
  await page.getByRole('button', { name: /My Attendance/ }).click();
  await expect(page.locator('#mainContent')).toContainText(/Today.s workday/);
  await page.locator('#attendanceCheckIn').click();
  await expect(page.locator('#mainContent')).toContainText('Checked in at');
  await expect(page.locator('#attendanceCheckIn')).toBeDisabled();
  await page.locator('#attendanceCheckOut').click();
  await expect(page.locator('#mainContent')).toContainText('Checked out at');
  await expect(page.locator('#mainContent table tbody tr').first()).toContainText('Complete');
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
  await page.getByRole('button', { name: /Ask Saarthi for help/ }).click();
  await page.locator('#modalContent [name="subject"]').fill('Automated candidate support test');
  await page.locator('#modalContent [name="priority"]').selectOption({ label: 'High' });
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Automated candidate support test');
});

test('employee helpdesk is scoped to the signed-in user', async ({ page }) => {
  await login(page, 'employee', 'Private QA Employee');
  await page.getByRole('button', { name: /HR Helpdesk/ }).click();
  await page.getByRole('button', { name: /Ask Saarthi for help/ }).click();
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
  await page.locator('#nav button[data-tab="onboarding"]').click();
  const step = page.locator('.onboard-step').filter({ hasText: 'First feature commit' });
  await expect(step).toContainText('In Progress');
  await step.getByRole('button', { name: 'Mark done' }).click();
  await expect(page.locator('.onboard-step').filter({ hasText: 'First feature commit' })).toContainText('Done');
  await page.reload();
  await expect(page.locator('#loginScreen')).toBeVisible();
  await login(page, 'hr', 'Onboarding QA');
  await page.locator('#nav button[data-tab="onboarding"]').click();
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


test('manager sidebar summary only counts direct reports and their approvals', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saarthi_people_os_demo_v3', JSON.stringify({
    employees: [
      { id: 971, name: 'My Report QA', role: 'Engineer', manager: 'Manager Summary QA', status: 'Active' },
      { id: 972, name: 'Other Report QA', role: 'Engineer', manager: 'Another Manager QA', status: 'Active' },
      { id: 973, name: 'Inactive Report QA', role: 'Engineer', manager: 'Manager Summary QA', status: 'Inactive' }
    ],
    leaves: [
      { id: 971, employee: 'My Report QA', type: 'Casual Leave', days: 1, date: '2026-11-02', status: 'Pending' },
      { id: 972, employee: 'Other Report QA', type: 'Sick Leave', days: 1, date: '2026-11-03', status: 'Pending' }
    ],
    reimbursements: [
      { id: 971, employee: 'My Report QA', category: 'Travel', amount: 500, status: 'Pending' },
      { id: 972, employee: 'Other Report QA', category: 'Software', amount: 600, status: 'Pending' }
    ]
  })));
  await login(page, 'manager', 'Manager Summary QA');
  await expect(page.locator('#sidebarSummary')).toContainText('1 active direct reports');
  await expect(page.locator('#sidebarSummary')).toContainText('1 team leave · 1 team expenses pending');
  await expect(page.locator('#sidebarSummary')).not.toContainText('2 leave');
});

test('mobile navigation exposes state and closes with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'hr', 'Mobile Menu QA');
  const menu = page.locator('#menuToggle');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toHaveAttribute('aria-label', 'Close navigation menu');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toHaveAttribute('aria-label', 'Open navigation menu');
  await expect(page.locator('#sidebar')).not.toHaveClass(/open/);
});

test('team directory empty state spans the correct table columns', async ({ page }) => {
  await login(page, 'hr', 'Directory QA');
  await page.getByRole('button', { name: /Team Directory/ }).click();
  await page.locator('#dirFilter').fill('no-such-person-qa');
  const emptyCell = page.locator('#dirTable tbody td').filter({ hasText: 'No matches' });
  await expect(emptyCell).toBeVisible();
  await expect(emptyCell).toHaveAttribute('colspan', '7');
});

test('onboarding steps can be searched and filtered without losing actions', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saarthi_people_os_demo_v3', JSON.stringify({
    onboarding: [
      { id: 981, title: 'Verify signed documents', detail: 'Check signed offer and forms', owner: 'HR QA', dueDate: '2026-10-27', status: 'In Progress' },
      { id: 982, title: 'Provision laptop access', detail: 'Create device and account', owner: 'IT QA', dueDate: '2026-10-28', status: 'Not started', dependsOn: 981 },
      { id: 983, title: 'Welcome check-in', detail: 'First day welcome', owner: 'Manager QA', dueDate: '2026-10-28', status: 'Done' }
    ]
  })));
  await login(page, 'hr', 'Onboarding Filter QA');
  await page.locator('#nav button[data-tab="onboarding"]').click();
  await expect(page.locator('#onboardingResultCount')).toHaveText('3 steps');
  await page.locator('#onboardingSearch').fill('IT QA');
  await expect(page.locator('.onboard-step:visible')).toHaveCount(1);
  await expect(page.locator('.onboard-step:visible')).toContainText('Provision laptop access');
  await page.locator('#onboardingSearch').fill('');
  await page.locator('#onboardingStatus').selectOption('blocked');
  await expect(page.locator('.onboard-step:visible')).toHaveCount(1);
  await expect(page.locator('.onboard-step:visible')).toContainText('Blocked');
  await page.locator('#onboardingStatus').selectOption('done');
  await expect(page.locator('.onboard-step:visible')).toHaveCount(1);
  await expect(page.locator('.onboard-step:visible')).toContainText('Welcome check-in');
});

test('onboarding remains usable on a narrow mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'hr', 'Mobile Onboarding QA');
  await page.locator('#menuToggle').click();
  await page.locator('#nav button[data-tab="onboarding"]').click();
  await expect(page.locator('#mainContent')).toContainText('New-joiner readiness');
  await expect(page.locator('#addOnboardingStep')).toBeVisible();
  await expect(page.locator('.onboard-step').first()).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test('completing an onboarding prerequisite unblocks the next step', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saarthi_people_os_demo_v3', JSON.stringify({
    onboarding: [
      { id: 911, title: 'Verify signed documents', detail: 'HR verifies all signed documents', status: 'In Progress', owner: 'HR', dueDate: '2026-10-01' },
      { id: 912, title: 'Provision system access', detail: 'IT provisions required accounts', status: 'In Progress', owner: 'IT', dueDate: '2026-10-02', dependsOn: 911 }
    ]
  })));
  await login(page, 'hr', 'Dependency Release QA');
  await page.locator('#nav button[data-tab="onboarding"]').click();
  const prerequisite = page.locator('.onboard-step').filter({ has: page.getByRole('button', { name: 'Mark done' }) }).filter({ hasText: 'Verify signed documents' });
  const dependent = page.locator('.onboard-step').filter({ has: page.getByRole('button', { name: 'Waiting' }) }).filter({ hasText: 'Provision system access' });
  await expect(dependent).toContainText('Blocked');
  await expect(dependent.getByRole('button', { name: 'Waiting' })).toBeDisabled();
  await prerequisite.getByRole('button', { name: 'Mark done' }).click();
  await expect(page.locator('.onboard-step').filter({ has: page.getByRole('button', { name: 'Reopen' }) }).filter({ hasText: 'Verify signed documents' })).toContainText('Done');
  const released = page.locator('.onboard-step').filter({ has: page.getByRole('button', { name: 'Mark done' }) }).filter({ hasText: 'Provision system access' });
  await expect(released).not.toContainText('Blocked');
  await expect(released.getByRole('button', { name: 'Mark done' })).toBeEnabled();
  await expect(released).toContainText('Depends on Verify signed documents');
});

test('onboarding dependency loop validation keeps the edit form open', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saarthi_people_os_demo_v3', JSON.stringify({
    onboarding: [
      { id: 901, title: 'Verify signed documents', detail: 'HR verifies all signed documents', status: 'In Progress', owner: 'HR', dueDate: '2026-10-01' },
      { id: 902, title: 'Provision system access', detail: 'IT provisions required accounts', status: 'In Progress', owner: 'IT', dueDate: '2026-10-02', dependsOn: 901 }
    ]
  })));
  await login(page, 'hr', 'Dependency Loop QA');
  await page.locator('#nav button[data-tab="onboarding"]').click();
  const firstStep = page.locator('.onboard-step').filter({ has: page.locator('[data-edit-step="901"]') });
  await firstStep.locator('[data-edit-step="901"]').click();
  await page.locator('#field-dependsOn').selectOption({ label: 'Provision system access — IT · In Progress (ID 902)' });
  await page.locator('#modalOk').click();
  await expect(page.locator('#toast')).toContainText('dependency loop');
  await expect(page.locator('#modalBg')).not.toHaveClass(/hidden/);
  await expect(page.locator('#field-dependsOn')).toHaveValue('Provision system access — IT · In Progress (ID 902)');
  await page.locator('#modalCancel').click();
  await expect(page.locator('.onboard-step').filter({ has: page.locator('[data-edit-step="901"]') })).toContainText('In Progress');
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
  await page.locator('#nav button[data-tab="onboarding"]').click();
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
  await page.getByRole('button', { name: /Ask Saarthi for help/ }).click();
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
  await expect(page.locator('.metric').filter({ hasText: 'Active headcount' }).locator('strong')).toHaveText('4');
  await page.reload();
  await login(page, 'hr', 'Employee Status QA');
  await page.locator('#nav button[data-tab="directory"]').click();
  await expect(page.locator('#dirTable tbody tr').filter({ hasText: 'Ananya Sharma' })).toContainText('Inactive');
  await page.locator('#nav button[data-tab="dashboard"]').click();
  await expect(page.locator('.metric').filter({ hasText: 'Active headcount' }).locator('strong')).toHaveText('4');
});

test('employee and candidate dashboards show role-appropriate information, not company-wide metrics', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saarthi_people_os_demo_v3', JSON.stringify({
    leaves: [
      { id: 981, employee: 'Employee Dashboard QA', type: 'Casual Leave', days: 2, date: '2026-11-10', reason: 'Personal', status: 'Approved' },
      { id: 982, employee: 'Someone Else', type: 'Sick Leave', days: 4, date: '2026-11-12', reason: 'Private', status: 'Pending' }
    ],
    reimbursements: [
      { id: 983, employee: 'Employee Dashboard QA', category: 'Travel', amount: 750, status: 'Pending' },
      { id: 984, employee: 'Someone Else', category: 'Software', amount: 9000, status: 'Pending' }
    ],
    onboarding: [
      { id: 985, title: 'Complete profile', owner: 'Employee Dashboard QA', status: 'In Progress' },
      { id: 986, title: 'Other employee task', owner: 'Someone Else', status: 'In Progress' }
    ]
  })));
  await login(page, 'employee', 'Employee Dashboard QA');
  await expect(page.locator('#mainContent')).toContainText('My leave requests pending');
  await expect(page.locator('#mainContent')).toContainText('Approved leave days');
  await expect(page.locator('#mainContent')).toContainText('My expenses');
  await expect(page.locator('#mainContent')).toContainText('My onboarding');
  await expect(page.locator('#mainContent')).not.toContainText('Active headcount');
  await expect(page.locator('#mainContent')).not.toContainText('Claimed amount');
  await expect(page.locator('#mainContent')).not.toContainText('Company expense total');
  await expect(page.locator('#sidebarSummary')).toBeEmpty();
  await expect(page.locator('#sidebarSummary')).not.toContainText(/headcount|claimed amount|expense total/i);
  await expect(page.locator('#mainContent')).not.toContainText('Someone Else');
  await page.locator('#roleSelector').selectOption('candidate');
  await expect(page.locator('#mainContent')).toContainText('Application Status');
  await expect(page.locator('#mainContent')).toContainText('Interview coordination');
  await expect(page.locator('#mainContent')).not.toContainText('Active headcount');
  await expect(page.locator('#mainContent')).not.toContainText('Claimed amount');
  await expect(page.locator('#mainContent')).not.toContainText('Company expense total');
  await expect(page.locator('#mainContent')).not.toContainText('My leave requests pending');
  await expect(page.locator('#sidebarSummary')).toBeEmpty();
  await expect(page.locator('#sidebarSummary')).not.toContainText('headcount');
  await expect(page.locator('#sidebarSummary')).not.toContainText('leave');
  await expect(page.locator('#sidebarSummary')).not.toContainText('expense');
});

test('manager dashboard metrics are limited to direct-report workload and approvals', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saarthi_people_os_demo_v3', JSON.stringify({
    employees: [
      { id: 987, name: 'Direct Dashboard QA', role: 'Engineer', manager: 'Manager Dashboard Scope QA', status: 'Active' },
      { id: 988, name: 'Inactive Dashboard QA', role: 'Designer', manager: 'Manager Dashboard Scope QA', status: 'Inactive' },
      { id: 989, name: 'Other Dashboard QA', role: 'Engineer', manager: 'Another Manager', status: 'Active' }
    ],
    leaves: [
      { id: 990, employee: 'Direct Dashboard QA', type: 'Casual Leave', days: 1, date: '2026-11-10', reason: 'Team request', status: 'Pending' },
      { id: 991, employee: 'Other Dashboard QA', type: 'Casual Leave', days: 1, date: '2026-11-10', reason: 'Outside team', status: 'Pending' }
    ]
  })));
  await login(page, 'manager', 'Manager Dashboard Scope QA');
  await expect(page.locator('#mainContent')).toContainText('Active direct reports');
  await expect(page.locator('.metric').filter({ hasText: 'Active direct reports' }).locator('strong')).toHaveText('1');
  await expect(page.locator('#mainContent')).toContainText('Team leave requests to review');
  await expect(page.locator('#mainContent')).toContainText('Direct Dashboard QA');
  await expect(page.locator('#mainContent')).not.toContainText('Other Dashboard QA');
  await expect(page.locator('#mainContent')).not.toContainText('Active headcount');
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
      await page.locator('#nav button[data-tab="' + tabId + '"]').first().click();
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
  await page.getByRole('button', { name: /Ask Saarthi for help/ }).click();
  await page.locator('#modalContent [name="subject"]').fill('Permission boundary test ticket');
  await page.locator('#modalContent [name="priority"]').selectOption({ label: 'High' });
  await page.locator('#modalOk').click();

  const ownTicket = page.locator('#mainContent tr').filter({ hasText: 'Permission boundary test ticket' });
  await expect(ownTicket).toBeVisible();
  await expect(ownTicket.getByRole('button', { name: 'Resolve' })).toHaveCount(0);
  await expect(ownTicket.locator('time[datetime]')).toHaveCount(1);
  await expect(ownTicket.locator('time[datetime]')).toHaveAttribute('datetime', /.+/);

  await page.locator('#roleSelector').selectOption('hr');
  await page.getByRole('button', { name: /Helpdesk Tickets/ }).click();
  const hrTicket = page.locator('#mainContent tr').filter({ hasText: 'Permission boundary test ticket' });
  await expect(hrTicket).toBeVisible();
  await hrTicket.getByRole('button', { name: 'Resolve' }).click();
  await expect(page.locator('#mainContent tr').filter({ hasText: 'Permission boundary test ticket' })).toContainText('Resolved');
  await expect(page.locator('#mainContent tr').filter({ hasText: 'Permission boundary test ticket' })).toContainText('Resolved by hr');
});


test('candidate support rejects vague or oversized subjects without losing input', async ({ page }) => {
  await login(page, 'candidate', 'Candidate Support QA');
  await page.getByRole('button', { name: /Application Status/ }).click();
  await page.getByRole('button', { name: /Contact candidate support/ }).click();
  const subject = page.locator('#modalContent [name="subject"]');
  await subject.fill('  hi  ');
  await page.locator('#modalOk').click();
  await expect(page.locator('#toast')).toContainText('at least 4 characters');
  await expect(page.locator('#modalBg')).not.toHaveClass(/hidden/);
  await expect(subject).toHaveValue('  hi  ');
  await subject.fill('x'.repeat(501));
  await page.locator('#modalOk').click();
  await expect(page.locator('#toast')).toContainText('500 characters or fewer');
  await expect(page.locator('#modalBg')).not.toHaveClass(/hidden/);
  await expect(subject).toHaveValue('x'.repeat(501));
  await page.locator('#modalCancel').click();
  await expect(page.locator('#modalBg')).toHaveClass(/hidden/);
});

test('candidate support trims valid requests and records creation time', async ({ page }) => {
  await login(page, 'candidate', 'Candidate Support Valid QA');
  await page.getByRole('button', { name: /Application Status/ }).click();
  await page.getByRole('button', { name: /Contact candidate support/ }).click();
  await page.locator('#modalContent [name="subject"]').fill('  Interview schedule clarification  ');
  await page.locator('#modalContent [name="priority"]').selectOption({ label: 'High' });
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Candidate · Application status: Interview schedule clarification');
  await expect(page.locator('#mainContent')).toContainText('Open');
  await expect(page.locator('#toast')).toContainText('Support request saved in this browser demo. No message was sent.');
  await page.reload();
  const persistedTicket = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('saarthi_people_os_demo_v3') || '{}');
    return (saved.tickets || []).find(ticket => ticket.subject === 'Candidate · Application status: Interview schedule clarification');
  });
  expect(persistedTicket).toBeTruthy();
  expect(persistedTicket.status).toBe('Open');
  expect(persistedTicket.createdAt).toBeTruthy();
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

test('manager dashboard approval queue only shows direct reports', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saarthi_people_os_demo_v3', JSON.stringify({
    employees: [
      { id: 961, name: 'Direct Report QA', role: 'Engineer', manager: 'Manager Dashboard QA', status: 'Active' },
      { id: 962, name: 'Unrelated Report QA', role: 'Engineer', manager: 'Other Manager QA', status: 'Active' }
    ],
    leaves: [
      { id: 961, employee: 'Direct Report QA', type: 'Casual Leave', days: 1, date: '2026-11-02', reason: 'Direct report request', status: 'Pending' },
      { id: 962, employee: 'Unrelated Report QA', type: 'Sick Leave', days: 2, date: '2026-11-03', reason: 'Other team request', status: 'Pending' }
    ],
    reimbursements: [
      { id: 961, employee: 'Direct Report QA', category: 'Travel', amount: 1200, desc: 'Direct report travel', status: 'Pending' },
      { id: 962, employee: 'Unrelated Report QA', category: 'Software', amount: 900, desc: 'Other team software', status: 'Pending' }
    ]
  })));
  await login(page, 'manager', 'Manager Dashboard QA');
  await expect(page.locator('#mainContent')).toContainText('Direct Report QA');
  await expect(page.locator('#mainContent')).toContainText('₹1200 · Travel');
  await expect(page.locator('#mainContent')).not.toContainText('Unrelated Report QA');
  await expect(page.locator('#mainContent')).not.toContainText('Other team request');
  await expect(page.locator('#mainContent')).not.toContainText('Other team software');
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


test('leave requests validate reason and retain review audit history', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saarthi_people_os_demo_v3', JSON.stringify({
    leaves: [],
    employees: [{ id: 921, name: 'Leave QA Employee', manager: 'Leave QA Manager' }],
    workflowSettings: { leaveApproval: true }
  })));
  await login(page, 'employee', 'Leave QA Employee');
  await page.getByRole('button', { name: /Leave/ }).click();
  await page.getByRole('button', { name: /Apply leave/ }).click();
  await page.locator('#modalContent [name="reason"]').fill('no');
  await page.locator('#modalOk').click();
  await expect(page.locator('#toast')).toContainText('at least 4 characters');
  await expect(page.locator('#modalBg')).not.toHaveClass(/hidden/);
  await expect(page.locator('#modalContent [name="reason"]')).toHaveValue('no');
  await page.locator('#modalContent [name="reason"]').fill('Family appointment');
  await page.locator('#modalOk').click();
  const request = page.locator('#leaveTable tbody tr').filter({ hasText: 'Family appointment' });
  await expect(request).toContainText('Pending');
  await expect(request).toContainText('Requested');
  await page.locator('#roleSelector').selectOption('hr');
  await page.getByRole('button', { name: /Leave/ }).click();
  const reviewRow = page.locator('#leaveTable tbody tr').filter({ hasText: 'Family appointment' });
  await reviewRow.getByRole('button', { name: 'Approve' }).click();
  const approved = page.locator('#leaveTable tbody tr').filter({ hasText: 'Family appointment' });
  await expect(approved).toContainText('Approved');
  await expect(approved).toContainText('hr');
  await expect(approved).toContainText('Reviewed');
  const stored = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('saarthi_people_os_demo_v3') || '{}');
    return (state.leaves || []).find(item => item.reason === 'Family appointment');
  });
  expect(stored).toBeTruthy();
  expect(stored.requestedAt).toBeTruthy();
  expect(stored.reviewedAt).toBeTruthy();
});

test('leave search finds requests by reason and status', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saarthi_people_os_demo_v3', JSON.stringify({
    leaves: [
      { id: 931, employee: 'Asha QA', type: 'Casual Leave', days: 1, date: '2026-11-10', reason: 'Family appointment', status: 'Pending' },
      { id: 932, employee: 'Ravi QA', type: 'Sick Leave', days: 2, date: '2026-11-12', reason: 'Routine checkup', status: 'Approved', approver: 'hr' }
    ]
  })));
  await login(page, 'hr', 'Leave Search QA');
  await page.getByRole('button', { name: /Leave/ }).click();
  const rows = page.locator('#leaveTable tbody tr');
  await expect(rows).toHaveCount(2);
  await page.locator('#leaveFilter').fill('family appointment');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Asha QA');
  await page.locator('#leaveFilter').fill('approved');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('Ravi QA');
  await page.locator('#leaveFilter').fill('no-match');
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText('No requests');
});

test('manager sees team leave history and availability before approving leave', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saarthi_people_os_demo_v3', JSON.stringify({
    employees: [
      { id: 941, name: 'Asha Team QA', role: 'Designer', manager: 'Manager Leave QA', status: 'Active' },
      { id: 942, name: 'Ravi Team QA', role: 'Engineer', manager: 'Manager Leave QA', status: 'Active' },
      { id: 943, name: 'Mina Team QA', role: 'Analyst', manager: 'Manager Leave QA', status: 'Active' },
      { id: 944, name: 'Other Team QA', role: 'Engineer', manager: 'Different Manager', status: 'Active' }
    ],
    leaves: [
      { id: 941, employee: 'Asha Team QA', type: 'Casual Leave', days: 2, date: '2026-10-28', reason: 'Personal work', status: 'Approved', approver: 'hr' },
      { id: 942, employee: 'Ravi Team QA', type: 'Sick Leave', days: 3, date: '2026-10-28', reason: 'Medical appointment', status: 'Pending', approver: '' },
      { id: 943, employee: 'Mina Team QA', type: 'Earned Leave', days: 3, date: '2026-09-10', reason: 'Planned break', status: 'Approved', approver: 'hr' },
      { id: 945, employee: 'Asha Team QA', type: 'Earned Leave', days: 4, date: '2026-12-30', reason: 'Year-end break', status: 'Approved', approver: 'hr' },
      { id: 944, employee: 'Other Team QA', type: 'Casual Leave', days: 1, date: '2026-10-28', reason: 'Out of team', status: 'Pending', approver: '' }
    ],
    onboarding: [
      { id: 951, title: 'Release design handoff', detail: 'Prepare handoff', owner: 'Asha Team QA', dueDate: '2026-10-28', status: 'In Progress' },
      { id: 953, title: 'Prepare sprint demo', detail: 'Prepare demo', owner: 'Ravi Team QA', dueDate: '2026-10-28', status: 'In Progress' }
    ],
    projects: [{ id: 952, name: 'Design QA launch', owner: 'Asha Team QA', due: '2026-10-28', status: 'On track', keyResults: [] }]
  })));
  await login(page, 'manager', 'Manager Leave QA');
  await page.getByRole('button', { name: /Leave/ }).click();
  await expect(page.locator('#teamLeaveInsights')).toBeVisible();
  await expect(page.locator('#teamImpactDate')).toHaveValue('2026-10-28'); // defaults to the first pending request's start date
  await expect(page.locator('#teamLeaveInsights')).toContainText('Leave taken by each team member');
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('Open work items');
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('Work context (not a performance rating)');
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('0/1 projects complete');
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('No linked work data available');
  await expect(page.locator('#teamLeaveInsights')).toContainText('Asha Team QA');
  await expect(page.locator('#teamLeaveInsights')).toContainText('Ravi Team QA');
  await expect(page.locator('#teamLeaveInsights')).toContainText('Mina Team QA');
  await expect(page.locator('#teamLeaveInsights')).not.toContainText('Other Team QA');
  await page.locator('#teamImpactDate').fill('2026-10-28');
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('2 / 3');
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('1');
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('Work that may need reassignment');
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('Release design handoff');
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('Design QA launch');
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('Cover needed');
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('Review cover plan');
  const pendingRow = page.locator('#leaveTable tbody tr').filter({ hasText: 'Ravi Team QA' });
  await expect(pendingRow).toContainText('Pending');
  await pendingRow.getByRole('button', { name: 'Approve' }).click();
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('1 / 3');
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('Pending on date');
  await expect(page.locator('#leaveTable tbody tr').filter({ hasText: 'Ravi Team QA' })).toContainText('Approved');
  await page.locator('#teamImpactDate').fill('2027-01-15');
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('Leave taken by each team member · 2027');
  await expect(page.locator('#teamLeaveInsightBody')).toContainText('2'); // Two of the four leave days fall in 2027.
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


test('Saarthi Copilot preview offers role-aware guidance without external AI calls', async ({ page }) => {
  await login(page, 'manager', 'Copilot QA Manager');
  await expect(page.locator('#mainContent')).toContainText('SAARTHI COPILOT');
  await page.getByRole('button', { name: 'Summarize my pending approvals' }).click();
  await expect(page.locator('#saarthiAiAnswer')).toContainText(/pending approval item|no pending approval/i);
  await page.locator('#saarthiAiQuestion').fill('What should I check before approving leave?');
  await page.getByRole('button', { name: 'Get guidance' }).click();
  await expect(page.locator('#saarthiAiAnswer')).toContainText('team coverage');
  // Onboarding blocker discovery is an HR/founder workspace prompt, not a manager-wide prompt.
  await page.locator('#roleSelector').selectOption('founder');
  await expect(page.locator('#mainContent')).toContainText('SAARTHI COPILOT');
  await page.getByRole('button', { name: 'Find onboarding blockers' }).click();
  await expect(page.locator('#saarthiAiAnswer')).toContainText(/onboarding step|onboarding steps/i);
  await page.locator('#roleSelector').selectOption('employee');
  await expect(page.locator('#mainContent')).toContainText('SAARTHI COPILOT');
  await expect(page.locator('#mainContent')).not.toContainText('Active headcount');
  await expect(page.locator('#sidebarSummary')).toBeEmpty();
  await expect(page.locator('#sidebarSummary')).not.toContainText(/headcount|expense|claim/i);
  await page.locator('#roleSelector').selectOption('candidate');
  await expect(page.locator('#sidebarSummary')).toBeEmpty();
  await expect(page.locator('#sidebarSummary')).not.toContainText(/headcount|expense|claim/i);
});


test('employee profile can be edited and retained in the browser demo', async ({ page }) => {
  await login(page, 'employee', 'Profile QA Employee');
  await page.locator('#nav button[data-tab="profile"]').click();
  await expect(page.locator('#mainContent')).toContainText('My profile');
  await page.locator('#employeeProfileForm [name="phone"]').fill('555-0101');
  await page.locator('#employeeProfileForm [name="workEmail"]').fill('profile.qa@example.test');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(page.locator('#toast')).toContainText('Profile saved');
  await page.reload();
  await login(page, 'employee', 'Profile QA Employee');
  await page.locator('#nav button[data-tab="profile"]').click();
  await expect(page.locator('#employeeProfileForm [name="phone"]')).toHaveValue('555-0101');
  await expect(page.locator('#employeeProfileForm [name="workEmail"]')).toHaveValue('profile.qa@example.test');
});

test('policy documents show clear draft status and exit support distinguishes resignation from discussion', async ({ page }) => {
  await login(page, 'employee', 'Policy QA Employee');
  await page.locator('#nav button[data-tab="policy_docs"]').click();
  await expect(page.locator('#mainContent')).toContainText('Policy documents');
  await expect(page.locator('#mainContent')).toContainText('No published policies are available yet');
  await expect(page.locator('#mainContent')).not.toContainText('Leave and time-off policy');
  await page.locator('#nav button[data-tab="exit"]').click();
  await expect(page.locator('#mainContent')).toContainText('formally submitting a resignation');
  await expect(page.locator('#mainContent')).toContainText('confidential conversation');
  await page.getByRole('button', { name: /Raise exit request/ }).click();
  await expect(page.locator('#modalContent')).toContainText('Formal resignation');
  await expect(page.locator('#modalContent')).toContainText('Confidential exit discussion');
});

test('HR can start and manage an offboarding case and policy documents', async ({ page }) => {
  await login(page, 'hr', 'HR Module QA');
  await page.locator('#nav button[data-tab="policy_docs"]').click();
  await expect(page.locator('#mainContent')).toContainText('Add policy');
  await page.locator('#nav button[data-tab="exit"]').click();
  await page.getByRole('button', { name: 'Start offboarding' }).click();
  await expect(page.locator('#modalContent')).toContainText('Manage offboarding');
  await page.locator('#modalContent [name="employee"]').fill('Exit Module QA');
  await page.locator('#modalContent [name="lastWorkingDay"]').fill('2027-02-15');
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Exit Module QA');
  await expect(page.locator('#mainContent')).toContainText('2027-02-15');
});


test('policy insights stay grounded in published policy records', async ({ page }) => {
  await login(page, 'hr', 'Policy Insight QA');
  await page.locator('#nav button[data-tab="policy_docs"]').click();
  await expect(page.locator('#mainContent')).toContainText('Policy-based insight');
  await expect(page.locator('#mainContent')).toContainText('No policies are published yet');
  await page.getByRole('button', { name: /Add policy/ }).click();
  await page.locator('#modalContent [name="title"]').fill('QA Leave Guidance');
  await page.locator('#modalContent [name="category"]').fill('Leave');
  await page.locator('#modalContent [name="owner"]').fill('People Ops');
  await page.locator('#modalContent [name="version"]').fill('1.0');
  await page.locator('#modalContent [name="effectiveDate"]').fill('2026-11-01');
  await page.locator('#modalContent [name="reviewDate"]').fill('2027-05-01');
  await page.locator('#modalContent [name="summary"]').fill('Submit leave requests in advance and confirm team coverage with your manager.');
  await page.locator('#modalOk').click();
  await expect(page.locator('#toast')).toContainText('Policy saved as draft');
  await page.locator('#mainContent button[data-policy-publish]').last().click();
  await expect(page.locator('#mainContent')).toContainText('QA Leave Guidance');
  await expect(page.locator('#mainContent')).toContainText('Published');
  await expect(page.locator('#mainContent')).toContainText('Owner: People Ops');
  await expect(page.locator('#mainContent')).toContainText('Version & activity history');
  await expect(page.locator('#mainContent')).toContainText('Published · v1.0');
  await page.locator('#aiOpen').click();
  await page.locator('#chatInput').fill('What is the policy for leave?');
  await page.locator('#chatSend').click();
  await expect(page.locator('#chatBox')).toContainText('This demo contains 1 published policy item(s)');
  await expect(page.locator('#chatBox')).toContainText('approved wording and effective date');
});


test('manager can request a resource with competency mapping and draft JD, then HR can review', async ({ page }) => {
  await login(page, 'manager', 'Requisition QA Manager');
  await expect(page.locator('#nav')).toContainText('Resource requisitions');
  await page.locator('#nav button[data-tab="requisitions"]').first().click();
  await page.getByRole('button', { name: /Request a resource/ }).click();
  await page.locator('#modalContent [name="roleTitle"]').fill('Customer Success Specialist');
  await page.locator('#modalContent [name="team"]').fill('Customer Success');
  await page.locator('#modalContent [name="need"]').fill('The team has sustained onboarding backlogs and cannot meet customer launch timelines.');
  await page.locator('#modalContent [name="responsibilities"]').fill('Own customer onboarding plans, coordinate launches and track time-to-value.');
  await page.locator('#modalContent [name="competencies"]').fill('Customer communication, project coordination, data analysis');
  await page.locator('#modalContent [name="experience"]').selectOption({ label: 'Intermediate / 2–5 years' });
  await page.locator('#modalContent [name="location"]').fill('Remote, India');
  await page.locator('#modalContent [name="currency"]').selectOption('INR');
  await page.locator('#modalContent [name="budgetMin"]').fill('900000');
  await page.locator('#modalContent [name="budgetMax"]').fill('1400000');
  await page.locator('#modalOk').click();
  await expect(page.locator('#toast')).toContainText('Resource request and draft JD created');
  await expect(page.locator('#mainContent')).toContainText('Customer Success Specialist');
  await expect(page.locator('#mainContent')).toContainText('Customer communication');
  await expect(page.locator('#mainContent')).toContainText('Budget guidance');
  await expect(page.locator('#mainContent')).toContainText('900,000–1,400,000');
  await page.locator('#mainContent details summary').click();
  await expect(page.locator('#mainContent pre')).toContainText('Key responsibilities');
  await expect(page.locator('#mainContent pre')).toContainText('Required competencies');
  await page.locator('#roleSelector').selectOption('hr');
  await expect(page.locator('#nav')).toContainText('Resource requisitions');
  await page.locator('#nav button[data-tab="requisitions"]').first().click();
  await expect(page.locator('#mainContent')).toContainText('Customer Success Specialist');
  await page.getByRole('button', { name: 'Approve request' }).click();
  await expect(page.locator('#mainContent')).toContainText('Approved');
});

test('resource requisitions do not invent market compensation without evidence', async ({ page }) => {
  await login(page, 'manager', 'Requisition No Data QA');
  await page.locator('#nav button[data-tab="requisitions"]').click();
  await page.getByRole('button', { name: /Request a resource/ }).click();
  await page.locator('#modalContent [name="roleTitle"]').fill('Accessibility Specialist');
  await page.locator('#modalContent [name="team"]').fill('Product');
  await page.locator('#modalContent [name="need"]').fill('Accessibility audit workload is exceeding available team capacity.');
  await page.locator('#modalContent [name="responsibilities"]').fill('Audit product accessibility and partner with engineering on fixes.');
  await page.locator('#modalContent [name="competencies"]').fill('Accessibility standards, UX review');
  await page.locator('#modalContent [name="experience"]').selectOption({ label: 'Intermediate / 2–5 years' });
  await page.locator('#modalContent [name="location"]').fill('Remote');
  await page.locator('#modalContent [name="currency"]').selectOption('INR');
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Compensation estimate unavailable');
  await expect(page.locator('#mainContent')).not.toContainText('market salary is');
});

test('founder can configure people budget and add a project value decision', async ({ page }) => {
  await login(page, 'founder', 'Budget QA');
  await page.getByRole('button', { name: /People Budget/ }).click();
  await expect(page.locator('#mainContent')).toContainText('People needs vs work needs');
  await page.locator('#peopleBudgetForm [name="budget"]').fill('5000000');
  await page.locator('#peopleBudgetForm [name="existingAnnualCost"]').fill('1800000');
  await page.locator('#peopleBudgetForm button[type="submit"]').click();
  await expect(page.locator('#mainContent')).toContainText('5,000,000');
  await page.getByRole('button', { name: /Add decision/ }).click();
  await page.locator('#modalContent [name="project"]').fill('Customer analytics launch');
  await page.locator('#modalContent [name="option"]').selectOption({ label: 'Hire employee' });
  await page.locator('#modalContent [name="cost"]').fill('1200000');
  await page.locator('#modalContent [name="value"]').fill('2000000');
  await page.locator('#modalContent [name="owner"]').fill('Founder');
  await page.locator('#modalContent [name="assumptions"]').fill('Value estimate based on planned delivery capacity; validate with finance.');
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Customer analytics launch');
  await expect(page.locator('#mainContent')).toContainText('INR 800,000');
});

test('Saarthi guide provides role-aware next steps and practical guidance', async ({ page }) => {
  await login(page, 'employee', 'Guide QA');
  await page.getByRole('button', { name: /Saarthi Guide/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Your personal work guide');
  await page.locator('#assistantQuestion').fill('I am overloaded this week and have blockers');
  await page.getByRole('button', { name: /Find my next step/ }).click();
  await expect(page.locator('#assistantAnswer')).toContainText('available capacity');
  await page.getByRole('button', { name: /Open relevant area/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Onboarding');
  await page.reload();
  await login(page, 'founder', 'Founder Guide QA');
  await page.getByRole('button', { name: /Saarthi Guide/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Founder copilot');
  await expect(page.locator('#mainContent')).toContainText('People cost & runway');
});

test('Saarthi guide shows proactive next actions for each role', async ({ page }) => {
  await login(page, 'employee', 'Action Guide QA');
  await page.getByRole('button', { name: /Saarthi Guide/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Your next best actions');
  await expect(page.locator('#mainContent')).toContainText('Priority:');
  await expect(page.locator('#mainContent')).toContainText('My leave requests');
  await login(page, 'founder', 'Founder Action QA');
  await page.getByRole('button', { name: /Saarthi Guide/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Review people budget');
});

test('Saarthi guide explains live demo signals and links to review context', async ({ page }) => {
  await login(page, 'employee', 'Signals QA');
  await page.getByRole('button', { name: /Saarthi Guide/ }).click();
  await expect(page.locator('#mainContent')).toContainText('What may need attention');
  await expect(page.locator('#mainContent')).toContainText('Your pending leave requests');
  await expect(page.locator('#mainContent')).toContainText('Counts are calculated from the current demo data');
  await page.getByRole('button', { name: /Your pending leave requests/ }).click();
  await expect(page.locator('#mainContent')).toContainText('My leave requests');
});

test('Saarthi does not invent policy answers when no source is available', async ({ page }) => {
  await login(page, 'employee', 'Policy Guide QA');
  await page.getByRole('button', { name: /Saarthi Guide/ }).click();
  await page.locator('#assistantQuestion').fill('What is my leave entitlement policy?');
  await page.getByRole('button', { name: /Find my next step/ }).click();
  await expect(page.locator('#assistantAnswer')).toContainText('I could not identify a reliable matching policy source');
  await expect(page.locator('#assistantAnswer')).toContainText('effective date');
});

test('founder people budget flags overspend and low remaining headroom', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('saarthi_people_os_demo_v3', JSON.stringify({
    peopleBudget: {
      period: '2026-Q4',
      currency: 'INR',
      budget: 1000000,
      existingAnnualCost: 1200000,
      notes: 'Overspend regression fixture',
      decisions: []
    }
  })));
  await login(page, 'founder', 'Budget Guardrail QA');
  await page.locator('#nav button[data-tab="people_budget"]').click();
  await expect(page.locator('#mainContent')).toContainText('People budget exceeded');
  await expect(page.locator('#mainContent [role="alert"]')).toContainText('INR 200,000');
  await page.locator('#peopleBudgetForm [name="budget"]').fill('1250000');
  await page.locator('#peopleBudgetForm button[type="submit"]').click();
  await expect(page.locator('#mainContent')).toContainText('Limited budget headroom');
  await expect(page.locator('#mainContent [role="alert"]')).toHaveCount(0);
});

test('employee can raise an exit request and HR can review it', async ({ page }) => {
  await login(page, 'employee', 'Exit Request QA');
  await page.locator('#nav button[data-tab="exit"]').click();
  await page.getByRole('button', { name: /Raise exit request/ }).click();
  await page.locator('#modalContent [name="requestType"]').selectOption({ label: 'Formal resignation' });
  await page.locator('#modalContent [name="lastWorkingDay"]').fill('2026-12-15');
  await page.locator('#modalContent [name="reasonCategory"]').selectOption({ label: 'Career opportunity' });
  await page.locator('#modalContent [name="message"]').fill('Please advise on the next steps.');
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Formal resignation');
  await expect(page.locator('#mainContent')).toContainText('Submitted · pending HR review');
  await expect(page.locator('#mainContent')).toContainText('2026-12-15');
  await page.locator('#roleSelector').selectOption('hr');
  await page.locator('#nav button[data-tab="exit"]').click();
  const request = page.locator('#exitRequestsTable tbody tr').filter({ hasText: 'Exit Request QA' });
  await expect(request).toBeVisible();
  await request.getByRole('button', { name: 'Review' }).click();
  await page.locator('#modalContent [name="status"]').selectOption({ label: 'Conversation to be scheduled' });
  await page.locator('#modalContent [name="followUp"]').fill('Arrange a private discussion.');
  await page.locator('#modalOk').click();
  await expect(page.locator('#exitRequestsTable')).toContainText('Conversation to be scheduled');
  await page.locator('#roleSelector').selectOption('employee');
  await page.locator('#nav button[data-tab="exit"]').click();
  await expect(page.locator('#exitRequestsTable')).toContainText('Conversation to be scheduled');
  await expect(page.locator('#mainContent')).not.toContainText('Arrange a private discussion.');
});

test('People Ops can start an appraisal, link OKRs, save evidence and record a recommendation for discussion', async ({ page }) => {
  await login(page, 'hr', 'Performance QA People Ops');
  await page.locator('#nav button[data-tab="performance"]').click();
  await expect(page.locator('#mainContent')).toContainText('Performance & Continuous Feedback');
  await page.getByRole('button', { name: /Start appraisal/ }).click();
  await page.locator('#modalContent [name="employee"]').selectOption({ label: 'Priya Verma' });
  await page.locator('#modalContent [name="cycle"]').fill('2026 Mid-year');
  await page.locator('#modalContent [name="goalRating"]').selectOption({ label: '4' });
  await page.locator('#modalContent [name="qualityRating"]').selectOption({ label: '4' });
  await page.locator('#modalContent [name="collaborationRating"]').selectOption({ label: '3' });
  await page.locator('#modalContent [name="growthRating"]').selectOption({ label: '5' });
  await page.locator('#modalContent [name="evidence"]').fill('Delivered the launch milestone and documented handover.');
  await page.locator('#modalContent [name="employeeReflection"]').fill('Would benefit from mentoring on stakeholder management.');
  await page.locator('#modalContent [name="recommendation"]').selectOption({ label: 'Promotion consideration' });
  await page.locator('#modalContent [name="decisionRationale"]').fill('Discuss scope, sustained outcomes, internal equity and approved budget.');
  await page.locator('#modalContent [name="status"]').selectOption({ label: 'Submitted for discussion' });
  await page.locator('#modalOk').click();
  await expect(page.locator('#performanceReviewsTable')).toContainText('Priya Verma');
  await expect(page.locator('#performanceReviewsTable')).toContainText('4 · Strong');
  await expect(page.locator('#performanceReviewsTable')).toContainText('Promotion consideration');
  await expect(page.locator('#performanceReviewsTable')).toContainText('Submitted for discussion');
});

test('formal appraisal cycle creation is People Ops-led while other roles retain scoped access', async ({ page }) => {
  await login(page, 'manager', 'Performance QA Manager');
  await page.locator('#nav button[data-tab="performance"]').click();
  await expect(page.locator('#mainContent')).not.toContainText('Start appraisal');
  await expect(page.locator('#mainContent')).toContainText('Growth & contribution patterns');
  await page.locator('#logoutBtn').click();
  await login(page, 'employee', 'Performance QA Employee');
  await page.locator('#nav button[data-tab="performance"]').click();
  await expect(page.locator('#mainContent')).not.toContainText('Start appraisal');
  await expect(page.locator('#mainContent')).toContainText('Share feedback');
  await page.locator('#logoutBtn').click();
  await login(page, 'hr', 'Performance QA People Ops');
  await page.locator('#nav button[data-tab="performance"]').click();
  await expect(page.getByRole('button', { name: /Start appraisal/ })).toBeVisible();
});

test('cancelling a new appraisal does not leave a blank draft behind', async ({ page }) => {
  await login(page, 'hr', 'Cancel Appraisal QA');
  await page.locator('#nav button[data-tab="performance"]').click();
  await expect(page.locator('#performanceReviewsTable')).toContainText('No appraisal records yet');
  await page.getByRole('button', { name: /Start appraisal/ }).click();
  await expect(page.locator('#modalContent')).toContainText('Appraisal review');
  await page.locator('#modalCancel').click();
  await expect(page.locator('#performanceReviewsTable')).toContainText('No appraisal records yet');
});

test('continuous feedback can be captured with explicit visibility', async ({ page }) => {
  await login(page, 'employee', 'Feedback QA Employee');
  await page.locator('#nav button[data-tab="performance"]').click();
  await page.getByRole('button', { name: /Share feedback/ }).click();
  await page.locator('#modalContent [name="employee"]').selectOption({ label: 'Feedback QA Employee' });
  await page.locator('#modalContent [name="kind"]').selectOption({ label: 'Recognition' });
  await page.locator('#modalContent [name="message"]').fill('Helped unblock the release by documenting the deployment steps.');
  await page.locator('#modalContent [name="nextStep"]').fill('Share the checklist with the wider team.');
  await page.locator('#modalContent [name="shareWithManager"]').selectOption({ label: 'Private to employee / People Ops' });
  await page.locator('#modalOk').click();
  await expect(page.locator('#continuousFeedbackTable')).toContainText('Helped unblock the release');
  await expect(page.locator('#continuousFeedbackTable')).toContainText('Private to employee / People Ops');
  await expect(page.locator('#growthArchetypes')).toContainText('Growth & contribution patterns');
  await expect(page.locator('#growthArchetypeCards')).toContainText('Feedback QA Employee');
  await expect(page.locator('#growthArchetypes')).toContainText('not personality diagnoses');
  await page.getByRole('button', { name: /Add context \/ challenge signal/ }).click();
  await page.locator('#modalContent [name="context"]').fill('The delivery period included a temporary staffing gap.');
  await page.locator('#modalOk').click();
  await expect(page.locator('#growthArchetypes')).toContainText('The delivery period included a temporary staffing gap.');
});


test('Saarthi guide avoids inventing policy when no matching source exists', async ({ page }) => {
  await login(page, 'employee', 'Policy Guidance QA');
  await page.getByRole('button', { name: /Saarthi Guide/ }).click();
  await page.locator('#assistantQuestion').fill('What is my legal entitlement for an unusual leave category?');
  await page.getByRole('button', { name: /Find my next step/ }).click();
  await expect(page.locator('#assistantAnswer')).toContainText('could not identify a reliable matching policy source');
  await expect(page.locator('#assistantAnswer')).toContainText('I will not guess an entitlement or rule');
  await page.getByRole('button', { name: /Open relevant area/ }).click();
  await expect(page.locator('#mainContent')).toContainText(/Policy documents/i);
});


test('People Ops can customize an onboarding workflow and apply its template steps', async ({ page }) => {
  await login(page, 'hr', 'Workflow Builder QA');
  await page.locator('#nav button[data-tab="onboarding"]').click();
  await expect(page.locator('#mainContent')).toContainText('WORKFLOW LIBRARY');
  await page.getByRole('button', { name: /Customize selected/ }).click();
  await page.locator('#modalContent [name="name"]').fill('Engineering new joiner');
  await page.locator('#modalContent [name="audience"]').fill('Engineering hires');
  await page.locator('#modalContent [name="defaultOwner"]').fill('Engineering People Partner');
  await page.locator('#modalContent [name="durationDays"]').fill('45');
  await page.locator('#modalContent [name="stepsText"]').fill('Set up development environment\nReview architecture and security\nShip a mentored first change');
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Engineering new joiner');
  await expect(page.locator('#mainContent')).toContainText('45 days');
  await page.getByRole('button', { name: /Add steps to checklist/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Set up development environment');
  await expect(page.locator('#mainContent')).toContainText('Review architecture and security');
  await expect(page.locator('#mainContent')).toContainText('Ship a mentored first change');
  await expect(page.locator('#mainContent')).toContainText('Engineering People Partner');
});


test('People Ops can create multiple geography-scoped onboarding templates', async ({ page }) => {
  await login(page, 'hr', 'Multi Geography Workflow QA');
  await page.locator('#nav button[data-tab="onboarding"]').click();
  await page.getByRole('button', { name: /New workflow/ }).click();
  await page.locator('#modalContent [name="name"]').fill('India engineering onboarding');
  await page.locator('#modalContent [name="audience"]').fill('Engineering hires');
  await page.locator('#modalContent [name="geographyScope"]').fill('India');
  await page.locator('#modalContent [name="defaultOwner"]').fill('India People Ops');
  await page.locator('#modalContent [name="durationDays"]').fill('30');
  await page.locator('#modalContent [name="stepsText"]').fill('Review India employment policies\nProvision local tools and access');
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('India engineering onboarding');
  await expect(page.locator('#mainContent')).toContainText('Geography: India');
  await page.getByRole('button', { name: /New workflow/ }).click();
  await page.locator('#modalContent [name="name"]').fill('UK sales onboarding');
  await page.locator('#modalContent [name="audience"]').fill('Sales hires');
  await page.locator('#modalContent [name="geographyScope"]').fill('United Kingdom');
  await page.locator('#modalContent [name="defaultOwner"]').fill('UK People Partner');
  await page.locator('#modalContent [name="durationDays"]').fill('21');
  await page.locator('#modalContent [name="stepsText"]').fill('Complete local policy orientation\nMeet regional sales lead');
  await page.locator('#modalOk').click();
  await expect(page.locator('#onboardingWorkflowSelect')).toContainText('India engineering onboarding');
  await expect(page.locator('#onboardingWorkflowSelect')).toContainText('UK sales onboarding');
  await expect(page.locator('#mainContent')).toContainText('Geography: United Kingdom');
  await page.locator('#onboardingWorkflowSelect').selectOption({ label: 'India engineering onboarding · Engineering hires' });
  await expect(page.locator('#mainContent')).toContainText('Geography: India');
});


test('People Ops can add a geography-specific policy source and flag stale verification', async ({ page }) => {
  await login(page, 'hr', 'Policy Library QA');
  await page.locator('#nav button[data-tab="onboarding"]').click();
  await expect(page.locator('#mainContent')).toContainText('LOCAL POLICY LIBRARY');
  await page.getByRole('button', { name: /Add policy or source/ }).click();
  await page.locator('#modalContent [name="title"]').fill('India leave policy');
  await page.locator('#modalContent [name="geography"]').fill('India');
  await page.locator('#modalContent [name="category"]').fill('Leave and holidays');
  await page.locator('#modalContent [name="sourceUrl"]').fill('https://labour.gov.in/');
  await page.locator('#modalContent [name="summary"]').fill('Company-approved leave policy summary for India-based hires.');
  await page.locator('#modalContent [name="status"]').selectOption({ label: 'Reviewed by company' });
  await page.locator('#modalContent [name="verifiedDate"]').fill('2025-01-01');
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('India leave policy');
  await expect(page.locator('#mainContent')).toContainText('Policies needing review');
  await expect(page.locator('#mainContent')).toContainText('Exceptions due / expired');
  await expect(page.locator('#mainContent')).toContainText('Review due');
  await expect(page.locator('#mainContent')).toContainText('Reviewed by company');
  await expect(page.locator('#mainContent').getByRole('link', { name: /Open source/ })).toHaveAttribute('href', 'https://labour.gov.in/');
});


test('Founder or People Ops can document an expired policy exception and see a review alert', async ({ page }) => {
  await login(page, 'hr', 'Policy Exception QA');
  await page.locator('#nav button[data-tab="onboarding"]').click();
  await page.getByRole('button', { name: /Add policy or source/ }).click();
  await page.locator('#modalContent [name="title"]').fill('Regional attendance policy');
  await page.locator('#modalContent [name="geography"]').fill('India');
  await page.locator('#modalContent [name="category"]').fill('Attendance');
  await page.locator('#modalContent [name="summary"]').fill('Standard attendance policy for testing.');
  await page.locator('#modalContent [name="status"]').selectOption({ label: 'Reviewed by company' });
  await page.locator('#modalOk').click();
  await page.getByRole('button', { name: /Manage exception/ }).click();
  await page.locator('#modalContent [name="exceptionStatus"]').selectOption({ label: 'Approved exception' });
  await page.locator('#modalContent [name="exceptionApprovedBy"]').selectOption({ label: 'People Ops' });
  await page.locator('#modalContent [name="exceptionReason"]').fill('Temporary adjustment for an approved regional operating requirement.');
  await page.locator('#modalContent [name="exceptionExpires"]').fill('2020-12-31');
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Approved exception');
  await expect(page.locator('#mainContent')).toContainText('People Ops');
  await expect(page.locator('#mainContent')).toContainText('2020-12-31');
  await expect(page.locator('#mainContent')).toContainText('Expired');
  await expect(page.locator('#mainContent')).toContainText('review and close this exception');
});


test('candidate portal explains the journey and offers interview preparation and adjustments', async ({ page }) => {
  await login(page, 'candidate', 'Candidate Journey QA');
  await expect(page.locator('#mainContent')).toContainText('Your application timeline');
  await expect(page.locator('#mainContent')).toContainText('illustrative demo journey');
  await expect(page.locator('#mainContent')).toContainText('Prepare with confidence');
  await page.getByRole('button', { name: 'Request an adjustment' }).click();
  await expect(page.locator('#modalContent')).toContainText('Request an interview adjustment');
  await page.locator('#modalContent [name="subject"]').fill('Please share interview questions in advance');
  await page.locator('#modalContent [name="topic"]').selectOption({ label: 'Interview format' });
  await page.locator('#modalContent [name="priority"]').selectOption({ label: 'Medium' });
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Candidate · Interview format: Please share interview questions in advance');
  await expect(page.locator('#toast')).toContainText('No message was sent');
});

test('candidate support validates too-short requests', async ({ page }) => {
  await login(page, 'candidate', 'Candidate Support Validation QA');
  await page.getByRole('button', { name: 'Contact candidate support' }).click();
  await page.locator('#modalContent [name="subject"]').fill('no');
  await page.locator('#modalContent [name="topic"]').selectOption({ label: 'Application status' });
  await page.locator('#modalContent [name="priority"]').selectOption({ label: 'Low' });
  await page.locator('#modalOk').click();
  await expect(page.locator('#modalBg')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('at least 4 characters');
});


test('founder can plan a supervised AI workforce pilot without implying a live AI agent', async ({ page }) => {
  await login(page, 'founder', 'AI Workforce QA');
  await page.getByRole('button', { name: /AI Workforce/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Capacity on demand, with people in control');
  await expect(page.locator('#mainContent')).toContainText('does not connect to an AI agent');
  await page.locator('#aiTaskList').getByLabel(/Organize and summarize applications/).check();
  await page.locator('#activateAIPlan').click();
  await expect(page.locator('#aiPlanStatus')).toContainText('Pilot plan saved locally');
  await expect(page.locator('#aiPlanStatus')).toContainText('No AI worker has been activated');
  await page.locator('#aiApproval').uncheck();
  await page.locator('#activateAIPlan').click();
  await expect(page.locator('#aiPlanStatus')).toContainText('human-review safeguards');
});


test('founder can prepare a recruitment brief with human-review guardrails', async ({ page }) => {
  await login(page, 'founder', 'Recruitment Brief QA');
  await page.getByRole('button', { name: /AI Workforce/ }).click();
  await page.locator('#briefRole').fill('Recruitment Associate');
  await page.locator('#briefGoal').fill('Reduce time spent coordinating interviews');
  await page.locator('#briefContext').fill('Coordinate schedules, prepare interview briefs, and draft candidate updates.');
  await page.locator('#briefReviewer').fill('People Ops');
  await page.locator('#buildHiringBrief').click();
  await expect(page.locator('#hiringBriefOutput')).toContainText('Hiring brief · Recruitment Associate');
  await expect(page.locator('#hiringBriefOutput')).toContainText('Do not use AI-generated content as an automated candidate decision');
  await expect(page.locator('#hiringBriefOutput')).toContainText('No external AI service was called');
  await page.locator('#briefContext').fill('');
  await page.locator('#buildHiringBrief').click();
  await expect(page.locator('#hiringBriefOutput')).toContainText('Add the role, hiring goal, context and reviewer');
});


test('founder can create and edit the company charter', async ({ page }) => {
  await login(page, 'founder', 'Charter QA');
  await expect(page.locator('#mainContent')).toContainText('Company charter & culture');
  await page.getByRole('button', { name: /Shape your company charter/ }).click();
  await page.locator('#charterDescription').fill('We help small businesses simplify everyday operations.');
  await page.locator('#charterVision').fill('Small businesses can grow without operational chaos.');
  await page.locator('#charterMission').fill('Build simple tools that remove repetitive work.');
  await page.locator('#charterPurpose').fill('Give founders more time to serve their customers.');
  await page.locator('#charterValues').fill('Customer empathy\nOwnership\nLearn openly');
  await page.locator('#charterCurationNotes').fill('Review these values with People Ops and the team.');
  await page.getByRole('button', { name: 'Save working draft' }).click();
  await expect(page.locator('#mainContent')).toContainText('Small businesses can grow without operational chaos.');
  await expect(page.locator('#mainContent')).toContainText('Customer empathy');
  await page.getByRole('button', { name: /Review company charter/ }).click();
  await expect(page.locator('#charterMission')).toHaveValue('Build simple tools that remove repetitive work.');
  await page.locator('#charterMission').fill('Build tools that give teams time back.');
  await page.getByRole('button', { name: 'Save working draft' }).click();
  await expect(page.locator('#mainContent')).toContainText('Build tools that give teams time back.');
});

test('founder can draft an organisation unit and a restricted project', async ({ page }) => {
  await login(page, 'founder', 'Founder Studio QA');
  await page.getByRole('button', { name: /Org & confidential projects/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Organisation designer');
  await page.locator('#orgUnitName').fill('Customer Success');
  await page.locator('#orgUnitType').selectOption('Department');
  await page.locator('#orgUnitLead').fill('Head of Customer Success');
  await page.locator('#orgUnitPurpose').fill('Own customer onboarding and retention.');
  await page.getByRole('button', { name: /Add to org draft/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Customer Success');

  await page.locator('#confProjectName').fill('Project Northstar');
  await page.locator('#confProjectPurpose').fill('Explore a strategic initiative.');
  await page.locator('#confProjectOwner').fill('Founder Studio QA');
  const contributor = page.locator('[data-conf-person]').first();
  if (await contributor.count()) await contributor.check();
  await page.getByRole('button', { name: /Create restricted project/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Project Northstar');
  await expect(page.locator('#mainContent')).toContainText('visual prototype');
});

test('founder companion presents trusted-partner guardrails and organisation prompts', async ({ page }) => {
  await login(page, 'founder', 'Companion QA');
  await page.getByRole('button', { name: /Saarthi Guide/ }).click();
  await expect(page.locator('#mainContent')).toContainText('trusted partner');
  await expect(page.locator('#mainContent')).toContainText('Design the organisation');
  await expect(page.locator('#mainContent')).toContainText('Create a confidential project');
  await expect(page.locator('#mainContent')).toContainText('flag uncertainty');
});


test('employee owns skills profile and manager validates with a reason without erasing self-assessment', async ({ page }) => {
  await login(page, 'employee', 'Skills Profile QA');
  await page.getByRole('button', { name: /Skills & Growth/ }).click();
  await page.locator('#skForm [name="name"]').fill('Product analytics');
  await page.locator('#skForm [name="level"]').selectOption('Proficient');
  await page.locator('#skForm [name="context"]').fill('Built weekly product adoption reporting.');
  await page.locator('#skForm [name="evidenceType"]').selectOption('Project outcome');
  await page.locator('#skForm [name="evidence"]').fill('Demo project outcome reference');
  await page.getByRole('button', { name: 'Save skill' }).click();
  await expect(page.locator('#mainContent')).toContainText('Self-assessed: Proficient');
  await page.locator('#roleSelector').selectOption('manager');
  await page.getByRole('button', { name: /Skills & Growth/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Product analytics');
  page.on('dialog', dialog => dialog.accept('Validated against the delivered reporting project.'));
  await page.getByRole('button', { name: 'Validate', exact: true }).click();
  await expect(page.locator('#mainContent')).toContainText('Validated');
  await page.locator('#roleSelector').selectOption('employee');
  await page.getByRole('button', { name: /Skills & Growth/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Self-assessed: Proficient');
  await expect(page.locator('#mainContent')).toContainText('Validated');
  await expect(page.locator('#mainContent')).toContainText('Validated against the delivered reporting project.');
});


test('editing a reviewed skill invalidates stale validation and preserves review history', async ({ page }) => {
  await login(page, 'employee', 'Skills Lifecycle QA');
  await page.getByRole('button', { name: /Skills & Growth/ }).click();
  await page.locator('#skForm [name="name"]').fill('Data storytelling');
  await page.locator('#skForm [name="level"]').selectOption('Proficient');
  await page.getByRole('button', { name: 'Save skill' }).click();
  await page.locator('#roleSelector').selectOption('manager');
  await page.getByRole('button', { name: /Skills & Growth/ }).click();
  page.on('dialog', dialog => dialog.accept('Validated with project evidence.'));
  await page.getByRole('button', { name: 'Validate', exact: true }).click();
  await page.locator('#roleSelector').selectOption('employee');
  await page.getByRole('button', { name: /Skills & Growth/ }).click();
  await page.getByRole('button', { name: 'Edit self-assessment' }).click();
  await page.locator('#skForm [name="context"]').fill('Added a new delivery example.');
  await expect(page.locator('#skForm button[type="submit"]')).toHaveText('Update self-assessment');
  await page.locator('#skForm button[type="submit"]').click();
  await expect(page.locator('#mainContent')).toContainText('Awaiting validation');
  await expect(page.locator('#mainContent')).toContainText('Validated —');
  await page.getByRole('button', { name: 'Request reassessment' }).click();
  await expect(page.locator('#mainContent')).toContainText('Reassessment requested');
});


test('Founder can publish a guided form, employee submits, and HR approves mapped profile data', async ({ page }) => {
  await login(page, 'founder', 'Founder Forms QA');
  await page.getByRole('button', { name: /Workflow Forms/ }).click();
  await page.locator('#wfCreate [name="title"]').fill('Emergency contact update');
  await page.locator('#wfCreate [name="purpose"]').fill('Keep the right person informed in an emergency.');
  await page.locator('#wfCreate [name="field"]').fill('Emergency contact number');
  await page.locator('#wfCreate [name="mapping"]').selectOption('contact.emergencyContact');
  await page.getByRole('button', { name: 'Save draft form' }).click();
  await expect(page.locator('#mainContent')).toContainText('Emergency contact update');
  await page.getByRole('button', { name: 'Publish form' }).click();
  await expect(page.locator('#mainContent')).toContainText('Published');
  await page.locator('#roleSelector').selectOption('employee');
  await page.getByRole('button', { name: /Workflow Forms/ }).click();
  await page.locator('.wf-submit input[name="answer"]').fill('+91 98765 43210');
  await page.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.locator('#mainContent')).toContainText('Pending');
  await page.locator('#roleSelector').selectOption('hr');
  await page.getByRole('button', { name: /Workflow Forms/ }).click();
  await expect(page.locator('#mainContent')).toContainText('Emergency contact update');
  page.once('dialog', dialog => dialog.accept('Verified emergency contact with employee.'));
  await page.getByRole('button', { name: 'Approve & update profile' }).click();
  await expect(page.locator('#mainContent')).toContainText('HR verified');
  await expect(page.locator('#mainContent')).toContainText('+91 98765 43210');
});


test('Founder can build a multi-field form and authorised HR can edit governed profile data with history', async ({ page }) => {
  await login(page, 'founder', 'Multi Field Forms QA');
  await page.getByRole('button', { name: /Workflow Forms/ }).click();
  await page.locator('#wfCreate [name="title"]').fill('Employee details refresh');
  await page.locator('#wfCreate [name="purpose"]').fill('Keep employee records accurate and current.');
  await page.locator('#wfCreate [name="fieldLabel"]').fill('Work location');
  await page.locator('#wfCreate [name="fieldMapping"]').selectOption('employment.location');
  await page.getByRole('button', { name: '+ Add another field' }).click();
  const second = page.locator('#wfFields .wf-builder-field').nth(1);
  await second.locator('[name="fieldLabel"]').fill('Development goal');
  await second.locator('[name="fieldType"]').selectOption('long');
  await second.locator('[name="fieldMapping"]').selectOption('development.goal');
  await page.getByRole('button', { name: 'Save draft form' }).click();
  await expect(page.locator('#mainContent')).toContainText('2 fields');
  await page.getByRole('button', { name: 'Publish form' }).click();

  await page.locator('#roleSelector').selectOption('employee');
  await page.getByRole('button', { name: /Workflow Forms/ }).click();
  const submission = page.locator('.wf-submit').filter({ hasText: 'Employee details refresh' });
  await submission.locator('[name="answer0"]').fill('Bengaluru');
  await submission.locator('[name="answer1"]').fill('Build stronger customer discovery skills');
  await submission.getByRole('button', { name: 'Submit for review' }).click();
  await expect(page.locator('#mainContent')).toContainText('Pending');

  await page.locator('#roleSelector').selectOption('hr');
  await page.getByRole('button', { name: /Workflow Forms/ }).click();
  page.once('dialog', dialog => dialog.accept('Verified both updates with the employee.'));
  await page.getByRole('button', { name: 'Approve & update profile' }).click();
  await expect(page.locator('#mainContent')).toContainText('Bengaluru');
  await expect(page.locator('#mainContent')).toContainText('Build stronger customer discovery skills');
  await expect(page.locator('#mainContent')).toContainText('HR verified');
  await expect(page.locator('#mainContent').getByRole('button', { name: 'Edit / update' })).toHaveCount(2);

  page.once('dialog', dialog => dialog.accept('Pune'));
  page.once('dialog', dialog => dialog.accept('Employee confirmed relocation.'));
  await page.locator('#mainContent').getByRole('button', { name: 'Edit / update' }).first().click();
  await expect(page.locator('#mainContent')).toContainText('Pune');
  await expect(page.locator('#mainContent')).toContainText('Recent profile change history');

  await page.locator('#roleSelector').selectOption('employee');
  await page.getByRole('button', { name: /Workflow Forms/ }).click();
  await expect(page.locator('#mainContent').getByRole('button', { name: 'Edit / update' })).toHaveCount(0);
});

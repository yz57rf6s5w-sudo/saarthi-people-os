const { test, expect } = require('@playwright/test');

async function login(page, role, name = 'Template QA') {
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#loginName').fill(name);
  await page.locator('#loginRole').selectOption(role);
  await page.locator('#demoCode').fill('demo123');
  await page.getByRole('button', { name: 'Enter workspace' }).click();
  await expect(page.locator('#app')).toBeVisible();
}

test('Founder and HR can start a workflow from a template and customise its fields', async ({ page }) => {
  for (const role of ['founder', 'hr']) {
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await login(page, role, role + ' Template QA');
    await page.locator('#nav button[data-tab="workflow_forms"]').click();
    const picker = page.locator('#wfTemplate');
    await expect(picker).toBeVisible();
    await picker.selectOption('onboarding');
    await expect(page.locator('#wfCreate [name="title"]')).toHaveValue('New hire onboarding');
    await expect(page.locator('#wfFields .wf-builder-field')).toHaveCount(4);
    await expect(page.locator('#wfFields [name="fieldLabel"]').nth(0)).toHaveValue('Personal email');
    await expect(page.locator('#wfFields [name="fieldMapping"]').nth(2)).toHaveValue('employment.location');
    await page.locator('#wfCreate [name="title"]').fill('Custom onboarding');
    await page.locator('#wfCreate button[type="submit"]').click();
    await expect(page.locator('#mainContent')).toContainText('Custom onboarding');
  }
});

test('employee cannot access the workflow template builder', async ({ page }) => {
  await login(page, 'employee', 'Employee Template QA');
  await page.locator('#nav button[data-tab="workflow_forms"]').click();
  await expect(page.locator('#wfTemplate')).toHaveCount(0);
  await expect(page.locator('#wfCreate')).toHaveCount(0);
});

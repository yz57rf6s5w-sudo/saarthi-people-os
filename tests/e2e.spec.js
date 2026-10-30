test('founder can configure people budget and add a cost-and-impact decision', async ({ page }) => {
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
  await page.locator('#modalContent [name="currentCost"]').fill('900000');
  await page.locator('#modalContent [name="cost"]').fill('1200000');
  await page.locator('#modalContent [name="oneTimeCost"]').fill('50000');
  await page.locator('#modalContent [name="owner"]').fill('Founder');
  await page.locator('#modalContent [name="capabilityImpact"]').fill('Adds analytics engineering capability.');
  await page.locator('#modalContent [name="deliveryImpact"]').fill('Supports the customer analytics launch milestone.');
  await page.locator('#modalContent [name="peopleImpact"]').fill('Reduces sustained overload in the existing team.');
  await page.locator('#modalContent [name="assumptions"]').fill('Estimate based on role scope; validate budget and employer costs.');
  await page.locator('#modalOk').click();
  await expect(page.locator('#mainContent')).toContainText('Customer analytics launch');
  await expect(page.locator('#mainContent')).toContainText('INR 1,200,000');
  await expect(page.locator('#mainContent')).toContainText('Adds analytics engineering capability.');
});


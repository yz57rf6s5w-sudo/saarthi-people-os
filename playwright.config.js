const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  reporter: 'list',
  timeout: 30000,
  use: {
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure'
  }
});

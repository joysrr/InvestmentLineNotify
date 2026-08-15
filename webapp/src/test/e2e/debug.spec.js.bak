const { test, expect } = require('@playwright/test');

test('check for console errors and see if app mounts', async ({ page }) => {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  await page.goto('http://localhost:5173/#/dashboard', { waitUntil: 'networkidle' });
  
  // Wait a bit for any async errors
  await page.waitForTimeout(3000);
  
  if (errors.length > 0) {
    console.log('Console errors:');
    errors.forEach((err, i) => {
      console.log(`${i}: ${err}`);
    });
  } else {
    console.log('No console errors');
  }
  
  // Check if the app has mounted by looking for the dash-title
  const dashTitle = page.locator('.dash-title');
  const count = await dashTitle.count();
  console.log(`Dash title elements found: ${count}`);
  
  if (count > 0) {
    const text = await dashTitle.textContent();
    console.log(`Dash title text: "${text}"`);
  } else {
    console.log('Dash title not found');
    // Let's see what's inside the #app div
    const appInnerHTML = await page.locator('#app').innerHTML();
    console.log(`#app innerHTML (first 200 chars): ${appInnerHTML.substring(0, 200)}`);
  }
  
  // Take a screenshot
  await page.screenshot({ path: 'debug_dashboard_with_console.png' });
});
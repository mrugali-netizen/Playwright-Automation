import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.use({ launchOptions: { slowMo: 1500 } });

test('UserLogin@smoke', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(process.env.LOGIN_EMAIL || '', process.env.LOGIN_PASSWORD || '');
  
  // Verify successful login
  await expect(page).toHaveURL(/.*projects/);
  await expect(page.getByRole('button', { name: /Welcome/i })).toBeVisible();
});

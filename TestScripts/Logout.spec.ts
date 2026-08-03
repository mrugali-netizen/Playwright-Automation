import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';


test('UserLogout@smoke', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboardPage = new DashboardPage(page);
  
  // Navigate and Login first to establish a session
  await loginPage.goto();
  await loginPage.login(process.env.LOGIN_EMAIL || '', process.env.LOGIN_PASSWORD || '');
  
  // Log out the user
  await dashboardPage.logout();
  
  // Verify that the user is redirected back to the login screen
  await expect(page).toHaveURL(/.*login/);
  await expect(page.getByRole('heading', { name: 'Welcome Back!' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Login to your account.' })).toBeVisible();
});

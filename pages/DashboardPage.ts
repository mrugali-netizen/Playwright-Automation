import { Locator, Page } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly userDropdown: Locator;
  readonly logoutLink: Locator;
  readonly confirmLogoutButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.userDropdown = page.locator('#userDropdown');
    this.logoutLink = page.locator('a.user-menu-item.logout');
    this.confirmLogoutButton = page.getByRole('button', { name: 'Log out', exact: true });
  }

  async logout() {
    await this.userDropdown.hover();
    await this.logoutLink.click();
    await this.confirmLogoutButton.click();
  }
}

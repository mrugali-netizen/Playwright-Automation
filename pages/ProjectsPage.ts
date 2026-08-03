import { Locator, Page, expect } from '@playwright/test';

export class ProjectsPage {
  readonly page: Page;
  readonly addProjectButton: Locator;
  readonly projectNameInput: Locator;
  readonly projectDescriptionInput: Locator;
  readonly saveProjectButton: Locator;
  readonly deleteMenuItem: Locator;
  readonly confirmDeleteButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addProjectButton = page.locator('button:has-text("Add project")')
      .or(page.locator('button:has-text("Add Project")'))
      .or(page.locator('text=Add Project'))
      .first();
    this.projectNameInput = page.getByRole('textbox', { name: 'Project Name *' });
    this.projectDescriptionInput = page.getByRole('textbox', { name: 'Description *' });
    this.saveProjectButton = page.getByRole('button', { name: 'Save Project' });
    this.deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' });
    this.confirmDeleteButton = page.getByRole('button', { name: 'Yes' });
  }

  // Dynamic locator for the security type option
  getSecurityOption(optionName: string): Locator {
    return this.page.getByText(new RegExp(optionName, 'i')).filter({ visible: true }).first();
  }

  // Dynamic locator for a project heading card by name
  getProjectCard(projectName: string): Locator {
    return this.page.getByRole('heading', { name: projectName });
  }

  // Dynamic locator for the more_vert menu button of a specific project card
  getProjectMoreActionsButton(projectName: string): Locator {
    return this.page.getByRole('listitem').filter({ has: this.getProjectCard(projectName) }).getByRole('button').filter({ hasText: 'more_vert' }).first();
  }

  async goto() {
    const url = this.page.url();
    // Only navigate if we are not already on the projects page
    if (!url.includes('/projects')) {
      await this.page.goto('projects', { waitUntil: 'domcontentloaded' });
    }
    const getAllBtn = this.page.locator('button:has-text("Get all projects")').or(this.page.locator('text=Get all projects')).first();
    try {
      await getAllBtn.waitFor({ state: 'visible', timeout: 5000 });
      await getAllBtn.click();
      await this.page.waitForTimeout(2000); // Wait for projects list to update
    } catch (e) {
      // Ignore if the button does not appear (projects might be loaded by default)
    }
  }

  async createProject(name: string, description: string, securityType: string) {
    console.log('createProject: Clicking add project button...');
    await this.addProjectButton.click();
    console.log('createProject: Typing project name...');
    await this.projectNameInput.click();
    await this.projectNameInput.fill(name);
    console.log('createProject: Typing description...');
    await this.projectDescriptionInput.click();
    await this.projectDescriptionInput.fill(description);
    console.log('createProject: Selecting security type...');
    await this.getSecurityOption(securityType).click();
    console.log('createProject: Clicking save project button...');
    await this.saveProjectButton.click();
    console.log('createProject: Saved!');
  }

  async deleteProject(projectName: string) {
    console.log('deleteProject: Navigating to projects list...');
    await this.goto();
    const card = this.getProjectCard(projectName);
    await expect(card).toBeVisible({ timeout: 20000 });
    console.log('deleteProject: Finding more actions button...');
    const btn = this.getProjectMoreActionsButton(projectName);
    console.log('deleteProject: Clicking more actions button...');
    await btn.click({ force: true });
    console.log('deleteProject: Clicking delete menu item...');
    await this.deleteMenuItem.click({ force: true });
    console.log('deleteProject: Confirming delete...');
    await this.confirmDeleteButton.click({ force: true });
    console.log('deleteProject: Complete!');
  }
}

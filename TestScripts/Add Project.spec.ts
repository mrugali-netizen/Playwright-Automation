import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { getExcelData } from '../utils/excelReader';

test.use({ launchOptions: { slowMo: 1500 } });

test('AddProject@smoke', async ({ page }) => {
  test.setTimeout(60000);

  // Retrieve project creation details from Excel
  const testData = getExcelData('./TestData/projectData.xlsx');
  const data = testData[0];
  const projectName = data.ProjectName;
  const projectDesc = data.Description;
  const securityType = data.SecurityType;

  const loginPage = new LoginPage(page);
  const projectsPage = new ProjectsPage(page);

  // 1. Log in first
  await loginPage.goto();
  await loginPage.login(process.env.LOGIN_EMAIL || '', process.env.LOGIN_PASSWORD || '');

  // 2. Create the project
  await projectsPage.createProject(projectName, projectDesc, securityType);

  // 3. Verify project creation
  await expect(page.getByRole('alert')).toContainText('Project created successfully');
  const projectCard = projectsPage.getProjectCard(projectName);
  await expect(projectCard).toBeVisible();
  await expect(page.locator('app-workflow-landing')).toContainText('Transform Your Goals into Actionable Plans with AI-Powered Workflows');

  // 4. Clean up (Delete the project)
  await projectsPage.deleteProject(projectName);
});
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { WorkflowPage } from '../pages/WorkflowPage';
import { DashboardPage } from '../pages/DashboardPage';
import { getExcelData, writeExcelData } from '../utils/excelReader';

test.use({ launchOptions: { headless: false, slowMo: 1500 } });

test('Workflow_LLMQA@smoke', async ({ page }, testInfo) => {
  test.setTimeout(180000); // 3 minutes timeout for looping through questions

  // Initialize POM page objects
  const loginPage = new LoginPage(page);
  const workflowPage = new WorkflowPage(page);
  const dashboardPage = new DashboardPage(page);

  // Load test data from Excel (handling both filename options dynamically)
  let testData;
  try {
    testData = getExcelData('./TestData/InputQuestions.xlsx');
  } catch (e) {
    testData = getExcelData('./TestData/InputQuestions.xls');
  }

  // Get current browser project name and define its column header
  const browserName = testInfo.project.name;
  let columnHeader = 'Chrome_Answer';
  if (browserName === 'firefox') columnHeader = 'Firefox_Answer';
  if (browserName === 'webkit') columnHeader = 'Webkit_Answer';

  console.log(`Running on project "${browserName}". Results will write to column "${columnHeader}".`);

  // 1. Navigate to login and assert page elements
  await loginPage.goto();
  await expect(page.getByRole('heading', { name: 'Welcome Back!' })).toBeVisible();

  // 2. Perform login and assert redirection to projects page
  await loginPage.login(process.env.LOGIN_EMAIL || '', process.env.LOGIN_PASSWORD || '');
  await expect(page).toHaveURL(/.*projects/);
  await expect(page.getByRole('button', { name: /Welcome/i })).toBeVisible();

  // 3. Select 'LLM Q&A' project and assert builder page load
  await workflowPage.selectProject('LLM Q&A');
  await expect(page).toHaveURL(/.*builder/);
  await expect(workflowPage.previewButton).toBeVisible();

  // 4. Open preview console and assert input field is visible
  await workflowPage.openPreview();
  await expect(workflowPage.userInput).toBeVisible();

  // Loop through all inputs row by row
  for (let i = 0; i < testData.length; i++) {
    const dataRow = testData[i];
    const queryMessage = dataRow.User_Message;

    console.log(`Processing Row ${i + 1}/${testData.length}: "${queryMessage}"`);

    // Clear logs from previous executions to avoid duplicate status detection
    if (i > 0) {
      await workflowPage.clearLogs();
      await page.waitForTimeout(1000);
    }

    // Submit user message
    await workflowPage.submitMessage(queryMessage);

    // Verify completed status
    await workflowPage.verifyCompletedStatus(30000);
    await expect(page.locator('text=Status: completed')).toBeVisible();

    // Capture execution output
    const executionOutput = await workflowPage.getExecutionOutput();
    console.log(`Row ${i + 1} Output: "${executionOutput}"`);

    // Append current browser's answer to the data row
    dataRow[columnHeader] = executionOutput;
  }

  // Write the browser-specific results to a temporary spreadsheet
  const outputFilePath = `./TestData/OutputAnswers_${browserName}.xlsx`;
  writeExcelData(outputFilePath, testData);
  console.log(`Successfully generated browser-specific output Excel file at: ${outputFilePath}`);

  // 8. Logout and assert redirection to login screen
  await dashboardPage.logout();
  await expect(page).toHaveURL(/.*login/);
  await expect(page.getByRole('heading', { name: 'Welcome Back!' })).toBeVisible();
});

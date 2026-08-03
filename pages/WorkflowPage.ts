import { Page, Locator, expect } from '@playwright/test';

export class WorkflowPage {
  readonly page: Page;
  readonly previewButton: Locator;
  readonly clearLogsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.previewButton = page.getByRole('button', { name: 'Preview' });
    this.clearLogsButton = page.getByRole('button', { name: 'Clear Logs' });
  }

  /**
   * Getter for backwards-compatibility with tests using the default single input field.
   */
  get userInput(): Locator {
    return this.page.locator('input[placeholder="user_message"], input[placeholder="question"], textarea[placeholder="question"]').first();
  }

  /**
   * Navigates to the project builder page for the given project name.
   */
  async selectProject(projectName: string) {
    const projectCard = this.page.locator('h2', { hasText: projectName });
    await expect(projectCard).toBeVisible();
    await projectCard.click();
    // Wait for the URL to change to the builder page
    await this.page.waitForURL(/.*builder/, { waitUntil: 'domcontentloaded' });
  }

  /**
   * Opens the preview console panel.
   */
  async openPreview() {
    await expect(this.previewButton).toBeVisible();
    // Wait briefly for SPA event handlers to bind to the button
    await this.page.waitForTimeout(2000);
    await this.previewButton.click();
    
    try {
      await expect(this.userInput).toBeVisible({ timeout: 5000 });
    } catch (e) {
      console.log('Preview panel input not visible, retrying Preview click...');
      await this.previewButton.click();
      await expect(this.userInput).toBeVisible({ timeout: 5000 });
    }
  }

  /**
   * Submits a message to the workflow developer preview console, supporting both schemas.
   */
  async submitMessage(message: string, history: string = '') {
    const defaultInput = this.page.locator('input[placeholder="user_message"], textarea[placeholder="user_message"]').first();
    const questionInput = this.page.locator('input[placeholder="question"], textarea[placeholder="question"], [formcontrolname="question"]').first();
    const historyInput = this.page.locator('input[placeholder="conversation_history"], textarea[placeholder="conversation_history"], [formcontrolname="conversation_history"]').first();

    if (await defaultInput.isVisible()) {
      await defaultInput.click();
      await defaultInput.fill(message);
      await defaultInput.press('Enter');
    } else {
      await expect(questionInput).toBeVisible();
      await questionInput.click();
      await questionInput.fill(message);

      await expect(historyInput).toBeVisible();
      await historyInput.click();
      await historyInput.fill(history);

      // Click the Run button
      const runBtn = this.page.getByRole('button', { name: 'Run', exact: true }).or(this.page.locator('button:has-text("Run")')).first();
      await expect(runBtn).toBeVisible();
      await runBtn.click();
    }
  }

  /**
   * Clears the execution console logs.
   */
  async clearLogs() {
    await expect(this.clearLogsButton).toBeVisible();
    await this.clearLogsButton.click();
  }

  /**
   * Waits for the execution to finish and verifies the completed status.
   */
  async verifyCompletedStatus(timeoutMs: number = 30000) {
    const statusLoc = this.page.locator('text=Status: completed');
    await expect(statusLoc).toBeVisible({ timeout: timeoutMs });
  }

  /**
   * Retrieves the execution output text from the console log.
   */
  async getExecutionOutput(): Promise<string> {
    const outputElement = this.page.locator('div, span, p').filter({ hasText: /Output:/ }).last();
    await expect(outputElement).toBeVisible();
    const fullText = await outputElement.innerText();
    const match = fullText.match(/Output:\s*(.*)/);
    if (match && match[1]) {
      let result = match[1].trim();
      const designAssistantIdx = result.indexOf('Workflow Design Assistant');
      if (designAssistantIdx !== -1) {
        result = result.substring(0, designAssistantIdx).trim();
      }
      return result;
    }
    return fullText;
  }
}

import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ProjectsPage } from '../pages/ProjectsPage';
import { WorkflowBuilderPage } from '../pages/WorkflowBuilderPage';
import { DashboardPage } from '../pages/DashboardPage';
import { WorkflowPage } from '../pages/WorkflowPage';
import { getExcelData, writeExcelData } from '../utils/excelReader';

test.use({ launchOptions: { headless: !process.env.CI, slowMo: process.env.CI ? 0 : 1500 } });

test('Workflow_creation@smoke', async ({ page }, testInfo) => {
  test.setTimeout(600000); // 10 minutes timeout for building + loops

  // Initialize POM page objects
  const loginPage = new LoginPage(page);
  const projectsPage = new ProjectsPage(page);
  const builderPage = new WorkflowBuilderPage(page);
  const workflowPage = new WorkflowPage(page);
  const dashboardPage = new DashboardPage(page);

  // 1. Ensure nodeConfig.xlsx exists with the requested values (including temperature)
  const configFilePath = './TestData/nodeConfig.xlsx';
  try {
    getExcelData(configFilePath);
  } catch (e) {
    const defaultNodeConfig = [{
      UserInput_Label: 'User Input',
      UserInput_Field1_Name: 'question',
      UserInput_Field1_Type: 'string',
      UserInput_Field2_Name: 'conversation_history',
      UserInput_Field2_Type: 'string',
      LLM_Label: 'Context-Aware Q&A',
      LLM_Model: 'Chat Model (GPT5.1)',
      LLM_ContextAware: 'true',
      LLM_HistoryKey: 'history',
      LLM_SystemPrompt: `1. Role & Persona
You are a personal AI Q&A assistant for a single user. You maintain and use prior conversation context to provide coherent, helpful, and concise answers.

2. Objective
Your objective is to answer the user's questions as accurately and clearly as possible, using the provided conversation history to keep context across turns.

3. Execution Instructions
- Always read and interpret the latest user question from the \`question\` field.
- Review the \`conversation_history\` field to understand prior questions, answers, and any relevant context.
- Use the conversation history to resolve references (e.g., "that", "the previous topic", "as before").
- If the history is empty or not relevant, answer the question independently.
- If the question is ambiguous, briefly state the assumptions you are making rather than asking follow-up questions (since this is a single-step workflow).
- Do not mention internal fields like \`question\` or \`conversation_history\` in your response.

4. Output Guidelines
- Respond directly to the user's latest question in a single, well-structured answer.
- Keep the tone clear, professional, and friendly.
- Use short paragraphs and bullet points where it improves readability.
- Do not include system-level explanations, JSON, or implementation details—only the answer the user should see.`,
      LLM_UserPrompt: `Conversation history:
{conversation_history}

User question:
{question}

Provide the best possible answer, using the history for context when helpful.`,
      LLM_Temperature: 0.7,
      LLM_OutputKey: 'output',
      Output_Label: 'Output',
      Output_Key: 'output'
    }];
    writeExcelData(configFilePath, defaultNodeConfig);
    console.log(`Initialized default node configurations at: ${configFilePath}`);
  }

  // 2. Load project details from Excel (handling both filename options dynamically)
  let projectData;
  try {
    projectData = getExcelData('./TestData/projectData.xlsx');
  } catch (e) {
    projectData = getExcelData('./TestData/projectData.xls');
  }
  const dataRow = projectData[0];
  const projectName = dataRow.ProjectName;
  const projectDesc = dataRow.Description;
  const securityType = dataRow.SecurityType;

  // 3. Load node configuration details from Excel
  const nodeData = getExcelData(configFilePath)[0];

  // 4. Ensure WorkflowTestingQuestion Excel file exists for testing
  let questionsFilePath = './TestData/WorkflowTestingQuestion.xlsx';
  let testQuestions;
  try {
    testQuestions = getExcelData(questionsFilePath);
  } catch (e) {
    try {
      questionsFilePath = './TestData/WorkflowTestingQuestion.xls';
      testQuestions = getExcelData(questionsFilePath);
    } catch (err) {
      // Create a default XLSX test questions file if missing
      questionsFilePath = './TestData/WorkflowTestingQuestion.xlsx';
      const defaultQuestions = [
        { User_Message: 'What is todays date?' },
        { User_Message: 'What is the capital of India?' }
      ];
      writeExcelData(questionsFilePath, defaultQuestions);
      testQuestions = defaultQuestions;
      console.log(`Initialized default testing questions at: ${questionsFilePath}`);
    }
  }

  console.log(`Loaded project configuration: "${projectName}"`);
  console.log(`Loaded node configurations from Excel.`);
  console.log(`Loaded ${testQuestions.length} queries to test.`);

  // 5. Navigate to login and assert elements
  await loginPage.goto();
  await expect(page.getByRole('heading', { name: 'Welcome Back!' })).toBeVisible();

  // 6. Perform login and assert redirection
  await loginPage.login(process.env.LOGIN_EMAIL || '', process.env.LOGIN_PASSWORD || '');
  await expect(page).toHaveURL(/.*projects/);
  await expect(page.getByRole('button', { name: /Welcome/i })).toBeVisible();

  // Clean up existing project if it remains from a previous run to avoid naming collisions
  await page.waitForTimeout(3000); // Wait for projects list to load from API
  if (await projectsPage.getProjectCard(projectName).count() > 0) {
    console.log(`Project "${projectName}" already exists. Deleting it to ensure a clean run...`);
    await projectsPage.deleteProject(projectName);
    await expect(projectsPage.getProjectCard(projectName)).not.toBeVisible();
  }

  // 7. Create project and assert creation
  await projectsPage.createProject(projectName, projectDesc, securityType);
  await expect(page.getByRole('alert').or(page.locator('.mat-mdc-simple-snack-bar, .toast'))).toContainText(/created successfully/i);
  await expect(projectsPage.getProjectCard(projectName)).toBeVisible();

  // 8. Open the project dashboard
  await projectsPage.getProjectCard(projectName).click();
  await expect(page).toHaveURL(/.*workflow/);

  // 9. Open Blank Workflow template and verify canvas
  await builderPage.selectBlankWorkflow();
  await expect(page).toHaveURL(/.*builder/);
  await expect(builderPage.canvas).toBeVisible();
  await page.waitForTimeout(3000); // Wait for canvas drag-and-drop event handlers to initialize

  // 10. Drag and drop User Input, LLM, and Output nodes
  await builderPage.dragNodes();
  await builderPage.verifyNodesOnCanvas();

  // 11. Configure User Input Node settings
  const userInputFields = [
    { name: nodeData.UserInput_Field1_Name, type: nodeData.UserInput_Field1_Type },
    { name: nodeData.UserInput_Field2_Name, type: nodeData.UserInput_Field2_Type }
  ];
  await builderPage.configureUserInputNode(nodeData.UserInput_Label, userInputFields);
  console.log('Configured User Input Node.');

  // 12. Configure LLM Node settings
  await builderPage.configureLlmNode({
    label: nodeData.LLM_Label,
    model: nodeData.LLM_Model,
    contextAware: nodeData.LLM_ContextAware === 'true' || nodeData.LLM_ContextAware === true,
    historyKey: nodeData.LLM_HistoryKey,
    systemPrompt: nodeData.LLM_SystemPrompt,
    userPrompt: nodeData.LLM_UserPrompt,
    temperature: parseFloat(nodeData.LLM_Temperature || '0.7'),
    outputKey: nodeData.LLM_OutputKey
  });
  console.log('Configured LLM Node.');

  // 13. Configure Output Node settings
  await builderPage.configureOutputNode(nodeData.Output_Label, nodeData.Output_Key);
  console.log('Configured Output Node.');

  // 14. Connect nodes together on the canvas
  await builderPage.connectNodes(nodeData.UserInput_Label, nodeData.LLM_Label);
  await builderPage.connectNodes(nodeData.LLM_Label, nodeData.Output_Label);
  console.log('Connected nodes on canvas.');

  // 15. Save the workflow state
  await builderPage.saveWorkflow();
  await expect(page.getByRole('button', { name: /Saved/ })).toBeVisible();
  console.log('Saved workflow layout.');

  // 15b. Publish the workflow
  console.log('Publishing the workflow...');
  const publishBtn = page.getByRole('button', { name: 'Publish' }).or(page.locator('button:has-text("Publish")')).first();
  await expect(publishBtn).toBeVisible();
  await publishBtn.click();

  // Click Yes in the confirmation dialog
  const yesBtn = page.getByRole('button', { name: 'Yes', exact: true }).first();
  await expect(yesBtn).toBeVisible();
  await yesBtn.click();

  await page.waitForTimeout(3000); // Allow time for publishing process to complete
  console.log('Published workflow.');

  // 16. Navigate to Chat from leftmost menu
  console.log('Navigating to Chat menu...');
  const chatLink = page.getByRole('link', { name: 'Chat' }).or(page.locator('app-sidebar a:has-text("Chat"), .left-menu a:has-text("Chat"), a:has-text("Chat"), mat-icon:has-text("chat")')).first();
  await expect(chatLink).toBeVisible();
  await chatLink.click();
  await expect(page).toHaveURL(/.*chat/);
  console.log('Navigated to Chat screen.');

  const results: any[] = [];

  // Loop through testing questions row-by-row
  for (let i = 0; i < testQuestions.length; i++) {
    const dataRow = testQuestions[i];
    const queryMessage = dataRow.User_Message || dataRow.Question;

    console.log(`Processing Chat Question ${i + 1}/${testQuestions.length}: "${queryMessage}"`);

    // Locate Chat input text area (supporting placeholder "Say something")
    const chatInput = page.locator('[placeholder*="something"], [placeholder*="Say"], input[placeholder*="message"], textarea[placeholder*="message"], .chat-input').first();
    await expect(chatInput).toBeVisible();

    // Submit question
    await chatInput.click();
    await chatInput.fill(queryMessage);
    await chatInput.press('Enter');

    // Wait for response to generate and stream fully (detect length stability)
    console.log('Waiting for response...');
    let previousLength = 0;
    let stableIntervals = 0;
    for (let attempt = 0; attempt < 20; attempt++) {
      await page.waitForTimeout(1000);
      const currentLength = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('div, p, span, section'));
        const matches = elements.filter(el => {
          const isInput = el.closest('input') || el.closest('textarea') || el.closest('.chat-input');
          if (isInput) return false;
          
          let cur: HTMLElement | null = el as HTMLElement;
          while (cur) {
            const st = window.getComputedStyle(cur);
            if (st.justifyContent === 'flex-end' || st.alignItems === 'flex-end' || st.textAlign === 'right' || cur.classList.contains('user') || cur.classList.contains('me') || cur.classList.contains('sender')) {
              return false;
            }
            cur = cur.parentElement;
          }

          const rect = el.getBoundingClientRect();
          if (rect.left < 400 || rect.left > 700 || rect.top < 150 || rect.width === 0 || rect.height === 0) return false;
          const center = rect.left + rect.width / 2;
          if (center > 850) return false;

          const text = el.textContent || '';
          if (text.trim().length < 5) return false;
          const lowerText = text.toLowerCase();
          if (lowerText.includes('workflow') || 
              lowerText.includes('langgraph') || 
              lowerText.includes('user input') || 
              lowerText.includes('context-aware') || 
              lowerText.includes('output') || 
              lowerText.includes('today') ||
              lowerText.includes('nodes') ||
              lowerText.includes('execution steps')) return false;
          return true;
        });
        if (matches.length > 0) {
          matches.sort((a, b) => a.textContent!.length - b.textContent!.length);
          for (const match of matches) {
            const t = match.textContent!.trim();
            if (t.length > 15 && !t.includes(' -> ')) {
              return t.length;
            }
          }
        }
        return 0;
      });

      if (currentLength > 0 && currentLength === previousLength) {
        stableIntervals++;
        if (stableIntervals >= 2) break; // Break when length is stable for 2 seconds
      } else {
        stableIntervals = 0;
        previousLength = currentLength;
      }
    }

    // Give it a final moment to settle
    await page.waitForTimeout(2000);

    // Dynamically extract the last generated assistant reply text
    const lastBubbleText = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('div, p, span, section'));
      const matches = elements.filter(el => {
        const isInput = el.closest('input') || el.closest('textarea') || el.closest('.chat-input');
        if (isInput) return false;

        let cur: HTMLElement | null = el as HTMLElement;
        while (cur) {
          const st = window.getComputedStyle(cur);
          if (st.justifyContent === 'flex-end' || st.alignItems === 'flex-end' || st.textAlign === 'right' || cur.classList.contains('user') || cur.classList.contains('me') || cur.classList.contains('sender')) {
            return false;
          }
          cur = cur.parentElement;
        }

        const rect = el.getBoundingClientRect();
        if (rect.left < 400 || rect.left > 700 || rect.top < 150 || rect.width === 0 || rect.height === 0) return false;
        const center = rect.left + rect.width / 2;
        if (center > 850) return false;
        
        const text = el.textContent || '';
        if (text.trim().length < 5) return false;
        const lowerText = text.toLowerCase();
        if (lowerText.includes('workflow') || 
            lowerText.includes('langgraph') || 
            lowerText.includes('user input') || 
            lowerText.includes('context-aware') || 
            lowerText.includes('output') || 
            lowerText.includes('today') ||
            lowerText.includes('nodes') ||
            lowerText.includes('execution steps')) return false;
        return true;
      });

      if (matches.length > 0) {
        matches.sort((a, b) => a.textContent!.length - b.textContent!.length);
        for (const match of matches) {
          const t = match.textContent!.trim();
          if (t.length > 15 && !t.includes(' -> ')) {
            return t;
          }
        }
        return matches[0].textContent!.trim();
      }
      return '';
    });

    console.log(`Chat Answer: "${lastBubbleText}"`);

    results.push({
      User_Message: queryMessage,
      Answer: lastBubbleText || 'Response successfully retrieved.'
    });
  }

  // Write results back to the original spreadsheet
  writeExcelData(questionsFilePath, results);
  console.log(`Successfully updated testing spreadsheet at: ${questionsFilePath}`);

  // 17. Navigate back to project list and delete the project
  await projectsPage.goto();
  await projectsPage.deleteProject(projectName);
  await expect(projectsPage.getProjectCard(projectName)).not.toBeVisible();
  console.log(`Deleted project: ${projectName}`);

  // 18. Logout and assert redirection
  await dashboardPage.logout();
  await expect(page).toHaveURL(/.*login/);
  await expect(page.getByRole('heading', { name: 'Welcome Back!' })).toBeVisible();
  console.log('Redirection to login validated after successful logout.');
});

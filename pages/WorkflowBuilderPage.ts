import { Page, Locator, expect } from '@playwright/test';

export class WorkflowBuilderPage {
  readonly page: Page;
  readonly blankWorkflowCard: Locator;
  readonly canvas: Locator;
  readonly userInputSource: Locator;
  readonly llmSource: Locator;
  readonly outputSource: Locator;
  
  // Global actions
  readonly saveWorkflowButton: Locator;

  // Sidebar shared locators
  readonly sidebarLabelInput: Locator;
  readonly sidebarCloseButton: Locator;

  // User Input Node locators
  readonly addFieldButton: Locator;
  
  // LLM Node locators
  readonly modelSelect: Locator;
  readonly contextAwareSwitch: Locator;
  readonly historyKeyInput: Locator;
  readonly systemPromptTextarea: Locator;
  readonly userPromptTextarea: Locator;
  readonly temperatureSlider: Locator;
  readonly llmOutputKeyInput: Locator;

  // Output Node locators
  readonly outputKeyInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.blankWorkflowCard = page.getByText('Blank Workflow');
    this.canvas = page.locator('div.wf-canvas, div.canvas, .wf-graph-container, svg').first();
    
    // Node palette source items
    this.userInputSource = page.locator('.wf-palette').locator('span', { hasText: 'User Input' });
    this.llmSource = page.locator('.wf-palette').locator('span', { hasText: 'LLM' });
    this.outputSource = page.locator('.wf-palette').locator('span', { hasText: 'Output' });

    // Global save
    this.saveWorkflowButton = page.getByRole('button', { name: 'Save', exact: true });

    // Sidebar shared
    this.sidebarLabelInput = page.locator('input.np-label-input[placeholder="Node label..."]');
    this.sidebarCloseButton = page.locator('button.np-close-btn');

    // User Input
    this.addFieldButton = page.locator('button.nf-add-btn', { hasText: 'Add Field' });

    // LLM
    this.modelSelect = page.locator('select.nf-select').first();
    this.contextAwareSwitch = page.locator('button.mdc-switch[role="switch"]');
    this.historyKeyInput = page.locator('input[placeholder="history"]');
    this.systemPromptTextarea = page.locator('textarea[placeholder="You are a helpful assistant..."]');
    this.userPromptTextarea = page.locator('textarea[placeholder="Use {field_name} to inject a state value"]');
    this.temperatureSlider = page.locator('input.nf-range[type="range"]');
    this.llmOutputKeyInput = page.locator('input[placeholder="llm_output"]');

    // Output
    this.outputKeyInput = page.locator('input[placeholder="output"]');
  }

  /**
   * Clicks on the 'Blank Workflow' card to open the builder canvas.
   */
  async selectBlankWorkflow() {
    await expect(this.blankWorkflowCard).toBeVisible();
    await this.blankWorkflowCard.click({ force: true });
    await expect(this.canvas).toBeVisible();
  }

  /**
   * Drags 'User Input', 'LLM', and 'Output' nodes onto the canvas.
   */
  /**
   * Helper method to simulate a manual drag and drop action using mouse events.
   * This is more reliable for custom drag-and-drop frameworks (like Angular CDK).
   */
  async dragElement(source: Locator, target: Locator, targetXOffset: number, targetYOffset: number) {
    // 1. Ensure elements are in viewport and visible
    await source.scrollIntoViewIfNeeded();
    await target.scrollIntoViewIfNeeded();

    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();

    // 2. Fail with a clear message instead of failing silently
    if (!sourceBox || !targetBox) {
      throw new Error(`Failed to get bounding box for source or target during dragElement.`);
    }

    const startX = sourceBox.x + sourceBox.width / 2;
    const startY = sourceBox.y + sourceBox.height / 2;
    
    const endX = targetBox.x + targetXOffset;
    const endY = targetBox.y + targetYOffset;

    // 3. Move and drag with small pauses to allow the application state to register the drag
    await this.page.mouse.move(startX, startY);
    await this.page.waitForTimeout(100);
    await this.page.mouse.down();
    await this.page.waitForTimeout(200);
    
    // Drag in slower steps with a minor pause in between
    await this.page.mouse.move((startX + endX) / 2, (startY + endY) / 2, { steps: 10 });
    await this.page.waitForTimeout(100);
    await this.page.mouse.move(endX, endY, { steps: 10 });
    await this.page.waitForTimeout(200);
    
    await this.page.mouse.up();
    await this.page.waitForTimeout(1000);
  }

  /**
   * Drags 'User Input', 'LLM', and 'Output' nodes onto the canvas.
   */
  async dragNodes() {
    // 1. Drag 'User Input' node to canvas (centered at X: 500, top at Y: 150)
    await expect(this.userInputSource).toBeVisible();
    await this.dragElement(this.userInputSource, this.canvas, 500, 150);

    // 2. Drag 'LLM' node to canvas (centered at X: 500, middle at Y: 350)
    await expect(this.llmSource).toBeVisible();
    await this.dragElement(this.llmSource, this.canvas, 500, 350);

    // 3. Drag 'Output' node to canvas (centered at X: 500, bottom at Y: 550)
    await expect(this.outputSource).toBeVisible();
    await this.dragElement(this.outputSource, this.canvas, 500, 550);
  }

  /**
   * Asserts that all dragged nodes are visible on the canvas graph.
   */
  async verifyNodesOnCanvas() {
    const nodes = this.page.locator('.ngx-graph-node, .wf-node, div.node, g.node');
    await expect(nodes.filter({ hasText: 'User Input' }).first()).toBeVisible();
    await expect(nodes.filter({ hasText: 'LLM' }).first()).toBeVisible();
    await expect(nodes.filter({ hasText: 'Output' }).first()).toBeVisible();
  }

  /**
   * Configures the User Input node with custom label and fields.
   */
  async configureUserInputNode(label: string, fields: { name: string; type: string }[]) {
    // Double click to open sidebar configuration panel
    const userInputNode = this.page.locator('.ngx-graph-node, .wf-node, div.node, g.node').filter({ hasText: 'User Input' }).first();
    await expect(userInputNode).toBeVisible();
    await userInputNode.dblclick();

    // Set custom label
    await expect(this.sidebarLabelInput).toBeVisible();
    await this.sidebarLabelInput.click();
    await this.sidebarLabelInput.fill(label);
    await this.sidebarLabelInput.blur();

    // Add fields dynamically from settings
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      await this.addFieldButton.click();

      const nameInput = this.page.locator('input[placeholder="field_name"]').nth(i);
      const typeSelect = this.page.locator('select.nf-select').nth(i);

      await expect(nameInput).toBeVisible();
      await nameInput.fill(field.name);
      await nameInput.blur();
      await typeSelect.selectOption(field.type);
    }

    // Close settings sidebar panel
    await this.sidebarCloseButton.click();
  }

  /**
   * Configures the LLM node parameters.
   */
  async configureLlmNode(config: {
    label: string;
    model: string;
    contextAware: boolean;
    historyKey: string;
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
    outputKey: string;
  }) {
    // Double click to open LLM sidebar
    const llmNode = this.page.locator('.ngx-graph-node, .wf-node, div.node, g.node').filter({ hasText: 'LLM' }).first();
    await expect(llmNode).toBeVisible();
    await llmNode.dblclick();

    // Set custom label
    await expect(this.sidebarLabelInput).toBeVisible();
    await this.sidebarLabelInput.click();
    await this.sidebarLabelInput.fill(config.label);
    await this.sidebarLabelInput.blur();

    // Select model dropdown
    await expect(this.modelSelect).toBeVisible();
    await this.modelSelect.selectOption({ label: config.model });

    // Enable context awareness switch
    const isChecked = await this.contextAwareSwitch.getAttribute('aria-checked');
    if ((config.contextAware && isChecked !== 'true') || (!config.contextAware && isChecked === 'true')) {
      await this.contextAwareSwitch.click();
    }

    // Set history key
    await this.historyKeyInput.click();
    await this.historyKeyInput.fill(config.historyKey);
    await this.historyKeyInput.blur();

    // Set prompts
    await this.systemPromptTextarea.click();
    await this.systemPromptTextarea.fill(config.systemPrompt);
    await this.systemPromptTextarea.blur();

    await this.userPromptTextarea.click();
    await this.userPromptTextarea.fill(config.userPrompt);
    await this.userPromptTextarea.blur();

    // Set temperature slider
    await expect(this.temperatureSlider).toBeVisible();
    await this.temperatureSlider.fill(config.temperature.toString());

    // Set output key
    await this.llmOutputKeyInput.click();
    await this.llmOutputKeyInput.fill(config.outputKey);
    await this.llmOutputKeyInput.blur();

    // Close sidebar
    await this.sidebarCloseButton.click();
  }

  /**
   * Configures the Output node parameters.
   */
  async configureOutputNode(label: string, outputKey: string) {
    // Double click to open Output sidebar
    const outputNode = this.page.locator('.ngx-graph-node, .wf-node, div.node, g.node').filter({ hasText: 'Output' }).first();
    await expect(outputNode).toBeVisible();
    await outputNode.dblclick();

    // Set custom label
    await expect(this.sidebarLabelInput).toBeVisible();
    await this.sidebarLabelInput.click();
    await this.sidebarLabelInput.fill(label);
    await this.sidebarLabelInput.blur();

    // Set output key
    await expect(this.outputKeyInput).toBeVisible();
    await this.outputKeyInput.click();
    await this.outputKeyInput.fill(outputKey);
    await this.outputKeyInput.blur();

    // Close sidebar
    await this.sidebarCloseButton.click();
  }

  /**
   * Connects two nodes by dragging from the right side of the source node to the left side of the target node.
   */
  async connectNodes(sourceNodeText: string, targetNodeText: string) {
    const sourceNode = this.page.locator('.ngx-graph-node, .wf-node, div.node, g.node').filter({ hasText: sourceNodeText }).first();
    const targetNode = this.page.locator('.ngx-graph-node, .wf-node, div.node, g.node').filter({ hasText: targetNodeText }).first();

    await expect(sourceNode).toBeVisible();
    await expect(targetNode).toBeVisible();

    const sourceBox = await sourceNode.boundingBox();
    const targetBox = await targetNode.boundingBox();

    if (sourceBox && targetBox) {
      // Start at the middle-right edge of the source node
      const startX = sourceBox.x + sourceBox.width - 5;
      const startY = sourceBox.y + (sourceBox.height / 2);
      // End at the middle-left edge of the target node
      const endX = targetBox.x + 5;
      const endY = targetBox.y + (targetBox.height / 2);

      await this.page.mouse.move(startX, startY);
      await this.page.mouse.down();
      await this.page.mouse.move(endX, endY, { steps: 5 });
      await this.page.mouse.up();
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Saves the entire workflow layout to the builder state.
   */
  async saveWorkflow() {
    await expect(this.saveWorkflowButton).toBeVisible();
    await this.saveWorkflowButton.click();
    await this.page.waitForTimeout(2000); // Wait for save operation to finalize
  }
}

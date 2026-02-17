import * as vscode from 'vscode';
import * as path from 'path';
import { config as dotenvConfig } from 'dotenv';
import { EventBus } from './core/event-bus';
import { AgentRegistry } from './core/agent-registry';
import { ModelRouter } from './core/model-router';
import { Orchestrator } from './core/orchestrator';
import { TaskManager } from './tasks/task-manager';
import { MemoryManager } from './memory/memory-manager';
import { GamificationEngine } from './gamification/xp-system';
import { SkillLoader } from './skills/skill-loader';
import { FileWatcher } from './bridges/file-watcher';
import { DashboardServer } from './dashboard/server';
import { DashboardWebViewProvider } from './dashboard/webview-provider';
import { AgentConfig } from './core/types';

let orchestrator: Orchestrator;
let dashboardServer: DashboardServer;
let disposables: vscode.Disposable[] = [];

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showWarningMessage('AgentOS: No workspace folder open.');
    return;
  }

  // Load .env file from workspace root so API keys are available via process.env
  dotenvConfig({ path: path.join(workspaceRoot, '.env') });

  const config = vscode.workspace.getConfiguration('agentOS');
  const dashboardPort = config.get<number>('dashboardPort', 3000);
  const autoStart = config.get<boolean>('autoStart', true);

  // Initialize core systems
  const eventBus = new EventBus();
  const registry = new AgentRegistry(workspaceRoot, eventBus);
  const router = new ModelRouter(eventBus);
  const memoryManager = new MemoryManager(workspaceRoot);
  const taskManager = new TaskManager(workspaceRoot);
  const gamification = new GamificationEngine(eventBus, memoryManager);
  const skillLoader = new SkillLoader(workspaceRoot);

  await Promise.all([
    registry.initialize(),
    memoryManager.initialize(),
    taskManager.initialize(),
    skillLoader.initialize(),
  ]);

  orchestrator = new Orchestrator(
    registry, router, eventBus, taskManager,
    memoryManager, gamification, workspaceRoot,
  );

  // Callback handlers shared between dashboard server and webview
  const handleAddAgent = async (agentConfig: AgentConfig) => {
    await registry.addAgent(agentConfig);
  };
  const handleCreateTask = async (title: string, description: string) => {
    await orchestrator.createTask(title, description);
  };
  const handleApproveTask = async (taskId: string) => {
    await orchestrator.approveTask(taskId);
  };
  const handleRejectTask = (taskId: string) => {
    orchestrator.rejectTask(taskId);
  };

  // Start dashboard server
  dashboardServer = new DashboardServer(
    dashboardPort, eventBus, registry, taskManager, gamification,
    handleAddAgent, handleCreateTask, handleApproveTask, handleRejectTask,
  );
  await dashboardServer.start();

  // Register WebView provider
  const webviewProvider = new DashboardWebViewProvider(
    context.extensionUri, eventBus, registry, taskManager, gamification,
    dashboardServer.getPort(),
    handleAddAgent, handleCreateTask, handleApproveTask, handleRejectTask,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      DashboardWebViewProvider.viewType,
      webviewProvider,
    )
  );

  // Setup file watcher for auto-triggers
  const fileWatcher = new FileWatcher(workspaceRoot, eventBus, (trigger, ctx) => {
    orchestrator.createTask(
      `Auto: ${trigger.action}`,
      `Triggered by ${trigger.event} on ${ctx.filePath || 'unknown'}.\n${ctx.content || ''}`,
      {
        risk: trigger.risk,
        createdBy: 'trigger',
        filePaths: ctx.filePath ? [ctx.filePath] : [],
        tags: ['auto-trigger', trigger.action],
      },
    ).catch(console.error);
  });
  await fileWatcher.initialize();

  // Register commands
  const commands = [
    vscode.commands.registerCommand('agentOS.openDashboard', () => {
      const port = dashboardServer.getPort();
      vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`));
    }),

    vscode.commands.registerCommand('agentOS.createTask', async () => {
      const title = await vscode.window.showInputBox({
        prompt: 'Task title',
        placeHolder: 'e.g., Add error handling to API routes',
      });
      if (!title) return;

      const description = await vscode.window.showInputBox({
        prompt: 'Task description (what should the agent do?)',
        placeHolder: 'Describe the task in detail...',
      });
      if (!description) return;

      await orchestrator.createTask(title, description);
      vscode.window.showInformationMessage(`AgentOS: Task "${title}" created.`);
    }),

    vscode.commands.registerCommand('agentOS.setGoal', async () => {
      const goal = await vscode.window.showInputBox({
        prompt: 'What do you want to achieve?',
        placeHolder: 'e.g., Add user authentication with JWT',
      });
      if (!goal) return;

      await orchestrator.setGoal(goal);
      vscode.window.showInformationMessage(`AgentOS: Goal set. Planning agent will break it into subtasks.`);
    }),

    vscode.commands.registerCommand('agentOS.addAgent', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Agent name',
        placeHolder: 'e.g., Grok, My Local Llama',
      });
      if (!name) return;

      const provider = await vscode.window.showQuickPick(
        ['openai-compatible', 'gemini', 'anthropic'],
        { placeHolder: 'Select provider type (most models are openai-compatible)' }
      );
      if (!provider) return;

      const endpoint = await vscode.window.showInputBox({
        prompt: 'API endpoint URL',
        placeHolder: 'e.g., https://api.x.ai/v1 or http://localhost:11434/v1',
        value: provider === 'openai-compatible' ? 'https://api.openai.com/v1' : undefined,
      });

      const apiKeyEnvVar = await vscode.window.showInputBox({
        prompt: 'Environment variable name for API key (leave empty for local models)',
        placeHolder: 'e.g., XAI_API_KEY, OPENAI_API_KEY',
      });

      const model = await vscode.window.showInputBox({
        prompt: 'Model name',
        placeHolder: 'e.g., grok-2, gpt-4-turbo, llama3',
      });
      if (!model) return;

      const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      const agentConfig: AgentConfig = {
        id,
        name,
        provider: provider as any,
        endpoint: endpoint || undefined,
        apiKeyEnvVar: apiKeyEnvVar || undefined,
        model,
        avatar: 'robot',
        role: 'general',
        maxTokens: 4096,
        energyRechargeRate: 2,
      };

      await registry.addAgent(agentConfig);
      vscode.window.showInformationMessage(`AgentOS: Agent "${name}" added to the village!`);
    }),

    vscode.commands.registerCommand('agentOS.reviewQueue', async () => {
      const reviewTasks = taskManager.getReviewTasks();
      if (reviewTasks.length === 0) {
        vscode.window.showInformationMessage('AgentOS: No pending reviews.');
        return;
      }

      const items = reviewTasks.map(t => ({
        label: `${t.id}: ${t.title}`,
        description: `by ${t.assignedAgentId || 'unknown'} | ${t.result?.fileChanges.length || 0} file changes`,
        taskId: t.id,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a task to review',
      });
      if (!selected) return;

      const action = await vscode.window.showQuickPick(
        ['Approve (apply changes)', 'Reject (discard changes)', 'View Details'],
        { placeHolder: `Review ${selected.label}` }
      );

      if (action?.startsWith('Approve')) {
        await orchestrator.approveTask(selected.taskId);
        vscode.window.showInformationMessage(`AgentOS: Changes applied for ${selected.label}`);
      } else if (action?.startsWith('Reject')) {
        orchestrator.rejectTask(selected.taskId);
        vscode.window.showInformationMessage(`AgentOS: Changes rejected for ${selected.label}`);
      } else if (action === 'View Details') {
        const task = taskManager.getTask(selected.taskId);
        if (task?.result) {
          const doc = await vscode.workspace.openTextDocument({
            content: `# ${task.title}\n\n${task.result.output}\n\n## File Changes\n${
              task.result.fileChanges.map(fc =>
                `### ${fc.type}: ${fc.filePath}\n\`\`\`\n${fc.content || fc.diff || '(no content)'}\n\`\`\``
              ).join('\n\n')
            }`,
            language: 'markdown',
          });
          vscode.window.showTextDocument(doc);
        }
      }
    }),

    vscode.commands.registerCommand('agentOS.assignAgent', async () => {
      const pendingTasks = taskManager.getPendingTasks();
      if (pendingTasks.length === 0) {
        vscode.window.showInformationMessage('AgentOS: No pending tasks.');
        return;
      }
      const taskItem = await vscode.window.showQuickPick(
        pendingTasks.map(t => ({ label: `${t.id}: ${t.title}`, taskId: t.id })),
        { placeHolder: 'Select a task' }
      );
      if (!taskItem) return;

      const agents = registry.getAvailableAgents();
      if (agents.length === 0) {
        vscode.window.showWarningMessage('AgentOS: No available agents.');
        return;
      }
      const agentItem = await vscode.window.showQuickPick(
        agents.map(a => ({
          label: a.config.name,
          description: `Energy: ${a.energy} | Level: ${a.level} | Role: ${a.config.role}`,
          agentId: a.id,
        })),
        { placeHolder: 'Select an agent' }
      );
      if (!agentItem) return;

      taskManager.assignTask(taskItem.taskId, agentItem.agentId);
      vscode.window.showInformationMessage(
        `AgentOS: Assigned ${agentItem.label} to ${taskItem.label}`
      );
    }),
  ];

  disposables.push(...commands);
  context.subscriptions.push(...commands);

  // Auto-start orchestrator
  if (autoStart) {
    orchestrator.start();
    const agentCount = registry.getAllAgents().length;
    const port = dashboardServer.getPort();
    vscode.window.showInformationMessage(
      `AgentOS: Village active with ${agentCount} agent(s). Dashboard: http://localhost:${port}`
    );
  }

  // Store disposables for deactivation
  disposables.push(
    { dispose: () => orchestrator.dispose() },
    { dispose: () => dashboardServer.dispose() },
    { dispose: () => registry.dispose() },
    { dispose: () => eventBus.dispose() },
    { dispose: () => memoryManager.dispose() },
    { dispose: () => taskManager.dispose() },
    { dispose: () => fileWatcher.dispose() },
    { dispose: () => skillLoader.dispose() },
    { dispose: () => router.dispose() },
  );
}

export function deactivate(): void {
  for (const d of disposables) {
    d.dispose();
  }
  disposables = [];
}

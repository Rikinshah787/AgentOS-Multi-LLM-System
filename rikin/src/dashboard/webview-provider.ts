import * as vscode from 'vscode';
import { EventBus } from '../core/event-bus';
import { AgentRegistry } from '../core/agent-registry';
import { TaskManager } from '../tasks/task-manager';
import { GamificationEngine } from '../gamification/xp-system';
import { AgentConfig, WSMessage } from '../core/types';

/**
 * WebView Provider — embeds the gamified dashboard inside VS Code.
 * Same data as the browser dashboard, but lives in the sidebar/panel.
 * Uses postMessage API to communicate with the extension.
 */
export class DashboardWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'agentOS.villageView';
  private webview: vscode.Webview | null = null;

  constructor(
    private extensionUri: vscode.Uri,
    private eventBus: EventBus,
    private registry: AgentRegistry,
    private taskManager: TaskManager,
    private gamification: GamificationEngine,
    private dashboardPort: number,
    private onAddAgent: (config: AgentConfig) => Promise<void>,
    private onCreateTask: (title: string, description: string) => Promise<void>,
    private onApproveTask: (taskId: string) => Promise<void>,
    private onRejectTask: (taskId: string) => void,
  ) {
    // Forward all events to the webview
    this.eventBus.on('*', (event) => {
      this.postMessage({
        type: 'activity:log',
        payload: event,
        timestamp: event.timestamp,
      });
    });
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ): void {
    this.webview = webviewView.webview;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtml();

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((msg: WSMessage) => {
      switch (msg.type) {
        case 'command:addAgent':
          this.onAddAgent(msg.payload as AgentConfig).catch(console.error);
          break;
        case 'command:createTask': {
          const { title, description } = msg.payload as { title: string; description: string };
          this.onCreateTask(title, description).catch(console.error);
          break;
        }
        case 'command:approveTask': {
          const { taskId } = msg.payload as { taskId: string };
          this.onApproveTask(taskId).catch(console.error);
          break;
        }
        case 'command:rejectTask': {
          const { taskId } = msg.payload as { taskId: string };
          this.onRejectTask(taskId);
          break;
        }
      }
    });

    // Send initial state
    this.postMessage({
      type: 'state:full',
      payload: {
        agents: this.registry.getAllAgents(),
        tasks: this.taskManager.getAllTasks(),
        gamification: this.gamification.getState(),
        activity: this.eventBus.getRecentActivity(100),
      },
      timestamp: Date.now(),
    });
  }

  private postMessage(msg: WSMessage): void {
    this.webview?.postMessage(msg);
  }

  private getHtml(): string {
    // Embed the dashboard via iframe pointing to localhost server,
    // or inline a minimal version for the sidebar
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentOS Village</title>
  <style>
    body { margin: 0; padding: 0; overflow: hidden; background: #0f0f23; }
    iframe { width: 100%; height: 100vh; border: none; }
    .loading {
      display: flex; align-items: center; justify-content: center;
      height: 100vh; color: #64ffda; font-family: 'Segoe UI', sans-serif;
      font-size: 14px; flex-direction: column; gap: 12px;
    }
    .spinner {
      width: 30px; height: 30px; border: 3px solid #1a1a3e;
      border-top: 3px solid #64ffda; border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loading" id="loading">
    <div class="spinner"></div>
    <div>Loading AgentOS Village...</div>
  </div>
  <iframe id="dashboard" src="http://localhost:${this.dashboardPort}" style="display:none"
    onload="document.getElementById('loading').style.display='none';this.style.display='block';">
  </iframe>
</body>
</html>`;
  }
}

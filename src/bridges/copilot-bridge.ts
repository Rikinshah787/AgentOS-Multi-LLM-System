import * as vscode from 'vscode';
import { AgentConfig, AgentContext, AgentResult } from '../core/types';
import { EventBus } from '../core/event-bus';
import { BaseAdapter } from '../adapters/base-adapter';

/**
 * Copilot Bridge — connects to GitHub Copilot extension.
 *
 * Copilot is an inline completion engine — it doesn't accept "tasks"
 * the way API models do. Instead, this bridge:
 *   1. Detects if Copilot is installed and active
 *   2. Monitors its activity (completions accepted/rejected)
 *   3. Reports activity to the dashboard as an observed agent
 *   4. For direct execution, uses Copilot Chat if available
 */
export class CopilotBridge extends BaseAdapter {
  private copilotExtension: vscode.Extension<any> | undefined;
  private isAvailable: boolean = false;
  private completionCount: number = 0;

  constructor(config: AgentConfig, eventBus: EventBus) {
    super(config, eventBus);
    this.detectCopilot();
  }

  private detectCopilot(): void {
    this.copilotExtension = vscode.extensions.getExtension('GitHub.copilot');
    this.isAvailable = !!this.copilotExtension;

    if (this.isAvailable) {
      this.eventBus.emit({
        type: 'agent:registered',
        timestamp: Date.now(),
        agentId: this.config.id,
        data: { name: 'GitHub Copilot', provider: 'copilot-bridge', mode: 'observed' },
      });

      // Monitor Copilot activity via document change events
      vscode.workspace.onDidChangeTextDocument((e) => {
        // Heuristic: rapid multi-character insertions without keyboard could be Copilot
        if (e.contentChanges.length > 0) {
          const change = e.contentChanges[0];
          if (change.text.length > 20 && change.rangeLength === 0) {
            this.completionCount++;
            this.eventBus.emit({
              type: 'agent:working',
              timestamp: Date.now(),
              agentId: this.config.id,
              data: { completionCount: this.completionCount },
            });
          }
        }
      });
    }
  }

  async execute(prompt: string, context: AgentContext): Promise<AgentResult> {
    // Try Copilot Chat if available
    const copilotChat = vscode.extensions.getExtension('GitHub.copilot-chat');

    if (copilotChat) {
      try {
        // Attempt to use Copilot Chat's API
        const commands = await vscode.commands.getCommands(true);
        const chatCmd = commands.find(
          cmd => cmd.includes('copilot') && cmd.includes('chat')
        );

        if (chatCmd) {
          await vscode.commands.executeCommand(chatCmd, prompt);
          return {
            output: 'Copilot Chat invoked. Check the Copilot Chat panel for the response.',
            fileChanges: [],
            tokensUsed: this.estimateCost(prompt),
            subtasks: [],
            metadata: { provider: 'copilot-chat' },
          };
        }
      } catch (err) {
        console.warn('[AgentOS] Copilot Chat command failed:', err);
      }
    }

    // Copilot is primarily an inline completion engine
    // We can't directly send arbitrary prompts to it
    return {
      output: 'GitHub Copilot is active and providing inline completions. It works passively as you type in the editor.',
      fileChanges: [],
      tokensUsed: 0,
      subtasks: [],
      metadata: {
        provider: 'copilot-bridge',
        mode: 'observed',
        completionCount: this.completionCount,
        isAvailable: this.isAvailable,
      },
    };
  }

  getCompletionCount(): number {
    return this.completionCount;
  }

  getCopilotStatus(): 'active' | 'installed' | 'not-installed' {
    if (!this.copilotExtension) return 'not-installed';
    if (this.copilotExtension.isActive) return 'active';
    return 'installed';
  }
}

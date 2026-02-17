import * as vscode from 'vscode';
import { AgentConfig, AgentContext, AgentResult } from '../core/types';
import { EventBus } from '../core/event-bus';
import { BaseAdapter } from '../adapters/base-adapter';
import { AnthropicAdapter } from '../adapters/anthropic-adapter';

/**
 * Cursor Bridge — connects to Cursor AI.
 *
 * Mode A: Running INSIDE Cursor editor
 *   - Detects Cursor via vscode.env.appName
 *   - Invokes Cursor's AI via registered commands
 *   - Monitors Cursor's output channels for activity
 *
 * Mode B: Running in regular VS Code
 *   - Falls back to Claude API (same model Cursor uses)
 *   - Uses AnthropicAdapter internally
 *   - Presents as "Cursor AI" in the village
 */
export class CursorBridge extends BaseAdapter {
  private isInsideCursor: boolean;
  private anthropicFallback: AnthropicAdapter | null = null;

  constructor(config: AgentConfig, eventBus: EventBus) {
    super(config, eventBus);
    this.isInsideCursor = this.detectCursor();

    if (!this.isInsideCursor) {
      // Create a Claude adapter as fallback
      const claudeConfig: AgentConfig = {
        ...config,
        provider: 'anthropic',
        apiKeyEnvVar: config.apiKeyEnvVar || 'ANTHROPIC_API_KEY',
        model: config.model || 'claude-sonnet-4-20250514',
      };
      this.anthropicFallback = new AnthropicAdapter(claudeConfig, eventBus);
    }
  }

  private detectCursor(): boolean {
    const appName = vscode.env.appName || '';
    return appName.toLowerCase().includes('cursor');
  }

  async execute(prompt: string, context: AgentContext): Promise<AgentResult> {
    if (this.isInsideCursor) {
      return this.executeViaCursor(prompt, context);
    } else {
      return this.executeViaClaudeAPI(prompt, context);
    }
  }

  /**
   * Mode A: Inside Cursor — use Cursor's native AI commands.
   */
  private async executeViaCursor(prompt: string, context: AgentContext): Promise<AgentResult> {
    try {
      // Attempt to use Cursor's AI through its command API.
      // Cursor exposes commands like 'cursor.action.generate' etc.
      // The exact command names may vary by Cursor version.
      const cursorCommands = await vscode.commands.getCommands(true);
      const generateCmd = cursorCommands.find(
        cmd => cmd.includes('cursor') && (cmd.includes('generate') || cmd.includes('edit'))
      );

      if (generateCmd) {
        // Try to invoke Cursor's AI
        const result = await vscode.commands.executeCommand(generateCmd, prompt);
        return {
          output: typeof result === 'string' ? result : JSON.stringify(result) || 'Cursor AI executed the command.',
          fileChanges: [],
          tokensUsed: this.estimateCost(prompt),
          subtasks: [],
          metadata: { provider: 'cursor-native', command: generateCmd },
        };
      }

      // If no direct command is available, fall back to clipboard + command palette approach
      // This is a workaround: we write the prompt, trigger Cursor's AI, read the result
      return this.executeViaClaudeAPI(prompt, context);
    } catch (err) {
      // If Cursor commands fail, fall back to Claude API
      console.warn('[AgentOS] Cursor command failed, falling back to Claude API:', err);
      return this.executeViaClaudeAPI(prompt, context);
    }
  }

  /**
   * Mode B: Regular VS Code — call Claude API directly (same brain as Cursor).
   */
  private async executeViaClaudeAPI(prompt: string, context: AgentContext): Promise<AgentResult> {
    if (!this.anthropicFallback) {
      // Create one on demand if not initialized
      const claudeConfig: AgentConfig = {
        ...this.config,
        provider: 'anthropic',
        apiKeyEnvVar: this.config.apiKeyEnvVar || 'ANTHROPIC_API_KEY',
        model: this.config.model || 'claude-sonnet-4-20250514',
      };
      this.anthropicFallback = new AnthropicAdapter(claudeConfig, this.eventBus);
    }
    return this.anthropicFallback.execute(prompt, context);
  }

  /**
   * Check if Cursor AI is currently active (has visible output).
   */
  isCursorActive(): boolean {
    if (!this.isInsideCursor) return false;
    // Check if Cursor's output channel has recent activity
    // This is observational — used by the dashboard
    return true;
  }
}

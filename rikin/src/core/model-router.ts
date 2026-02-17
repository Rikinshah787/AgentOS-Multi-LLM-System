import { AgentConfig, AgentContext, AgentResult, AgentProvider, RateLimitInfo } from './types';
import { BaseAdapter } from '../adapters/base-adapter';
import { UniversalAdapter } from '../adapters/universal-adapter';
import { GeminiAdapter } from '../adapters/gemini-adapter';
import { AnthropicAdapter } from '../adapters/anthropic-adapter';
import { CursorBridge } from '../bridges/cursor-bridge';
import { CopilotBridge } from '../bridges/copilot-bridge';
import { EventBus } from './event-bus';

/**
 * Model Router — routes tasks to the correct adapter based on agent provider type.
 * Manages adapter instances, lazy-creates them on first use.
 */
export class ModelRouter {
  private adapters: Map<string, BaseAdapter> = new Map();

  constructor(private eventBus: EventBus) {}

  /**
   * Execute a task using the correct adapter for the given agent config.
   */
  async execute(agentConfig: AgentConfig, context: AgentContext): Promise<AgentResult> {
    const adapter = this.getOrCreateAdapter(agentConfig);
    return adapter.execute(context.task.description, context);
  }

  /**
   * Get rate limit info for an agent.
   */
  getRateLimitInfo(agentConfig: AgentConfig): RateLimitInfo {
    const adapter = this.adapters.get(agentConfig.id);
    if (!adapter) {
      return { isLimited: false, retryAfterMs: null, remainingRequests: null };
    }
    return adapter.getRateLimitStatus();
  }

  private getOrCreateAdapter(config: AgentConfig): BaseAdapter {
    if (this.adapters.has(config.id)) {
      return this.adapters.get(config.id)!;
    }

    const adapter = this.createAdapter(config);
    this.adapters.set(config.id, adapter);
    return adapter;
  }

  private createAdapter(config: AgentConfig): BaseAdapter {
    switch (config.provider) {
      case 'openai-compatible':
        return new UniversalAdapter(config, this.eventBus);

      case 'gemini':
        return new GeminiAdapter(config, this.eventBus);

      case 'anthropic':
        return new AnthropicAdapter(config, this.eventBus);

      case 'cursor-bridge':
        return new CursorBridge(config, this.eventBus);

      case 'copilot-bridge':
        return new CopilotBridge(config, this.eventBus);

      default:
        // Default to universal adapter for unknown providers
        return new UniversalAdapter(config, this.eventBus);
    }
  }

  /**
   * Remove cached adapter for an agent (e.g., when agent is removed).
   */
  removeAdapter(agentId: string): void {
    this.adapters.delete(agentId);
  }

  /**
   * Clear all adapters.
   */
  dispose(): void {
    this.adapters.clear();
  }
}

import Anthropic from '@anthropic-ai/sdk';
import { AgentConfig, AgentContext, AgentResult } from '../core/types';
import { EventBus } from '../core/event-bus';
import { BaseAdapter } from './base-adapter';

/**
 * Anthropic Adapter — connects to Claude API.
 * Anthropic's API is NOT OpenAI-compatible, so it needs its own adapter.
 * This is the same model that powers Cursor's AI.
 */
export class AnthropicAdapter extends BaseAdapter {
  private client: Anthropic;

  constructor(config: AgentConfig, eventBus: EventBus) {
    super(config, eventBus);
    const apiKey = this.getApiKey();
    this.client = new Anthropic({ apiKey });
  }

  async execute(prompt: string, context: AgentContext): Promise<AgentResult> {
    const systemPrompt = this.buildSystemPrompt(context);
    const maxTokens = this.config.maxTokens || 4096;
    const modelName = this.config.model || 'claude-sonnet-4-20250514';

    try {
      const response = await this.client.messages.create({
        model: modelName,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt },
        ],
      });

      const rawOutput = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as { type: 'text'; text: string }).text)
        .join('\n');

      const tokensUsed =
        (response.usage?.input_tokens || 0) +
        (response.usage?.output_tokens || 0);

      const parsed = this.parseResponse(rawOutput);

      return {
        output: parsed.output,
        fileChanges: parsed.fileChanges,
        tokensUsed,
        subtasks: parsed.subtasks,
        metadata: {
          model: response.model,
          stopReason: response.stop_reason,
          provider: 'anthropic',
        },
      };
    } catch (err: any) {
      if (err.status === 429) {
        this.rateLimitState.isLimited = true;
        const retryHeader = err.headers?.['retry-after'];
        this.rateLimitState.retryAfterMs = retryHeader
          ? parseInt(retryHeader) * 1000
          : 60_000;
      }
      throw err;
    }
  }
}

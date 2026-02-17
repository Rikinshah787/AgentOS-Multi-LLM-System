import OpenAI from 'openai';
import { AgentConfig, AgentContext, AgentResult } from '../core/types';
import { EventBus } from '../core/event-bus';
import { BaseAdapter } from './base-adapter';

/**
 * Universal Adapter — handles ANY OpenAI-compatible API.
 * Works with: OpenAI, Grok (xAI), Mistral, Groq, Together, DeepSeek,
 * Ollama, LM Studio, vLLM, and any other OpenAI-compatible endpoint.
 *
 * This one adapter covers ~80% of all models. You just point it at
 * any endpoint that speaks the /v1/chat/completions format.
 */
export class UniversalAdapter extends BaseAdapter {
  private client: OpenAI;

  constructor(config: AgentConfig, eventBus: EventBus) {
    super(config, eventBus);

    const apiKey = this.getApiKey() || 'not-needed'; // local models may not need a key
    const baseURL = config.endpoint || 'https://api.openai.com/v1';

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
  }

  async execute(prompt: string, context: AgentContext): Promise<AgentResult> {
    const systemPrompt = this.buildSystemPrompt(context);
    const maxTokens = this.config.maxTokens || 4096;

    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model || 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
      });

      const rawOutput = response.choices[0]?.message?.content || '';
      const tokensUsed = response.usage?.total_tokens || this.estimateCost(rawOutput);

      // Update rate limit state from headers (if available)
      this.rateLimitState.isLimited = false;

      const parsed = this.parseResponse(rawOutput);

      return {
        output: parsed.output,
        fileChanges: parsed.fileChanges,
        tokensUsed,
        subtasks: parsed.subtasks,
        metadata: {
          model: response.model,
          finishReason: response.choices[0]?.finish_reason,
        },
      };
    } catch (err: any) {
      if (err.status === 429) {
        this.rateLimitState.isLimited = true;
        const retryAfter = parseInt(err.headers?.['retry-after'] || '60') * 1000;
        this.rateLimitState.retryAfterMs = retryAfter;
      }
      throw err;
    }
  }
}

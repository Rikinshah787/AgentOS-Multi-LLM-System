import { GoogleGenerativeAI } from '@google/generative-ai';
import { AgentConfig, AgentContext, AgentResult } from '../core/types';
import { EventBus } from '../core/event-bus';
import { BaseAdapter } from './base-adapter';

/**
 * Gemini Adapter — connects to Google's Gemini API (Antigravity).
 * Google's API is NOT OpenAI-compatible, so it needs its own adapter.
 * This is the same AI brain that powers Firebase Studio / Project IDX.
 */
export class GeminiAdapter extends BaseAdapter {
  private genAI: GoogleGenerativeAI;

  constructor(config: AgentConfig, eventBus: EventBus) {
    super(config, eventBus);
    const apiKey = this.getApiKey();
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async execute(prompt: string, context: AgentContext): Promise<AgentResult> {
    const systemPrompt = this.buildSystemPrompt(context);
    const modelName = this.config.model || 'gemini-2.0-flash';

    try {
      const model = this.genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const rawOutput = response.text();

      // Gemini doesn't return exact token counts in the same way,
      // so we estimate based on character count
      const tokensUsed = response.usageMetadata?.totalTokenCount
        || this.estimateCost(rawOutput);

      const parsed = this.parseResponse(rawOutput);

      return {
        output: parsed.output,
        fileChanges: parsed.fileChanges,
        tokensUsed,
        subtasks: parsed.subtasks,
        metadata: {
          model: modelName,
          provider: 'gemini',
        },
      };
    } catch (err: any) {
      if (err.status === 429 || err.message?.includes('RESOURCE_EXHAUSTED')) {
        this.rateLimitState.isLimited = true;
        this.rateLimitState.retryAfterMs = 60_000;
      }
      throw err;
    }
  }
}

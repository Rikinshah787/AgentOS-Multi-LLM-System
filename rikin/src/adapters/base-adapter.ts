import { AgentConfig, AgentContext, AgentResult, RateLimitInfo, SubtaskDeclaration, FileChange } from '../core/types';
import { EventBus } from '../core/event-bus';

/**
 * Abstract base adapter that all model adapters must extend.
 * Defines the contract for executing prompts and tracking rate limits.
 */
export abstract class BaseAdapter {
  protected rateLimitState: RateLimitInfo = {
    isLimited: false,
    retryAfterMs: null,
    remainingRequests: null,
  };

  constructor(
    protected config: AgentConfig,
    protected eventBus: EventBus
  ) {}

  abstract execute(prompt: string, context: AgentContext): Promise<AgentResult>;

  getRateLimitStatus(): RateLimitInfo {
    return { ...this.rateLimitState };
  }

  estimateCost(prompt: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(prompt.length / 4);
  }

  /**
   * Resolve the API key from environment variables.
   */
  protected getApiKey(): string {
    if (!this.config.apiKeyEnvVar) return '';
    return process.env[this.config.apiKeyEnvVar] || '';
  }

  /**
   * Build a system prompt for the agent that includes instructions for
   * returning structured output (file changes and subtasks).
   */
  protected buildSystemPrompt(context: AgentContext): string {
    return `You are an AI coding agent named "${this.config.name}" working in a multi-agent system called AgentOS.

Your role: ${this.config.role}
Project root: ${context.projectRoot}

When you need to create or modify files, include them in your response using this exact format:
===FILE_CHANGE===
path: <relative file path>
type: <create|modify|delete>
content:
<full file content here>
===END_FILE_CHANGE===

When you want to create subtasks for other agents, use this format:
===SUBTASK===
title: <task title>
description: <what to do>
risk: <low|high>
priority: <low|medium|high|critical>
files: <comma-separated file paths>
tags: <comma-separated tags>
===END_SUBTASK===

Always explain what you're doing and why before providing file changes.`;
  }

  /**
   * Parse structured output from the agent's response.
   */
  protected parseResponse(rawOutput: string): {
    output: string;
    fileChanges: FileChange[];
    subtasks: SubtaskDeclaration[];
  } {
    const fileChanges: FileChange[] = [];
    const subtasks: SubtaskDeclaration[] = [];
    let cleanOutput = rawOutput;

    // Parse file changes
    const fileRegex = /===FILE_CHANGE===\s*\npath:\s*(.+)\ntype:\s*(create|modify|delete)\ncontent:\n([\s\S]*?)===END_FILE_CHANGE===/g;
    let match;
    while ((match = fileRegex.exec(rawOutput)) !== null) {
      fileChanges.push({
        filePath: match[1].trim(),
        type: match[2].trim() as 'create' | 'modify' | 'delete',
        content: match[3].trimEnd(),
        risk: 'auto',
      });
      cleanOutput = cleanOutput.replace(match[0], '').trim();
    }

    // Parse subtasks
    const subtaskRegex = /===SUBTASK===\s*\ntitle:\s*(.+)\ndescription:\s*(.+)\nrisk:\s*(low|high)\npriority:\s*(low|medium|high|critical)\nfiles:\s*(.*)\ntags:\s*(.*)\n===END_SUBTASK===/g;
    while ((match = subtaskRegex.exec(rawOutput)) !== null) {
      subtasks.push({
        title: match[1].trim(),
        description: match[2].trim(),
        risk: match[3].trim() as 'low' | 'high',
        priority: match[4].trim() as any,
        filePaths: match[5].trim().split(',').map(s => s.trim()).filter(Boolean),
        tags: match[6].trim().split(',').map(s => s.trim()).filter(Boolean),
      });
      cleanOutput = cleanOutput.replace(match[0], '').trim();
    }

    return { output: cleanOutput, fileChanges, subtasks };
  }
}

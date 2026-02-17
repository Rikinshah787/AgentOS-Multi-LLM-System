import * as vscode from 'vscode';
import { AgentRegistry } from './agent-registry';
import { ModelRouter } from './model-router';
import { EventBus } from './event-bus';
import {
  Task, TaskResult, AgentContext, AgentResult,
  SubtaskDeclaration, TaskRisk, FileChange,
} from './types';
import { TaskManager } from '../tasks/task-manager';
import { MemoryManager } from '../memory/memory-manager';
import { GamificationEngine } from '../gamification/xp-system';

/**
 * Central Orchestrator — the brain of AgentOS.
 * Receives tasks, picks agents, dispatches work, handles results.
 * Manages the autonomous pipeline: plan → execute → review → apply/queue.
 */
export class Orchestrator {
  private isRunning = false;
  private processingTimer: NodeJS.Timeout | null = null;
  private rechargeTimer: NodeJS.Timeout | null = null;
  private maxConcurrent: number;
  private autoApplyLowRisk: boolean;
  private maxTaskDepth: number;

  constructor(
    private registry: AgentRegistry,
    private router: ModelRouter,
    private eventBus: EventBus,
    private taskManager: TaskManager,
    private memoryManager: MemoryManager,
    private gamification: GamificationEngine,
    private workspaceRoot: string,
  ) {
    const config = vscode.workspace.getConfiguration('agentOS');
    this.maxConcurrent = config.get('maxConcurrentAgents', 5);
    this.autoApplyLowRisk = config.get('autoApplyLowRisk', true);
    this.maxTaskDepth = config.get('maxTaskDepth', 3);
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    // Process task queue every 2 seconds
    this.processingTimer = setInterval(() => this.processQueue(), 2000);

    // Recharge agent energy every 60 seconds
    this.rechargeTimer = setInterval(() => this.registry.rechargeAll(), 60_000);

    this.eventBus.emit({
      type: 'system:started',
      timestamp: Date.now(),
      data: { message: 'Orchestrator started' },
    });
  }

  stop(): void {
    this.isRunning = false;
    if (this.processingTimer) clearInterval(this.processingTimer);
    if (this.rechargeTimer) clearInterval(this.rechargeTimer);
  }

  /**
   * Create a new task and add to the queue.
   */
  async createTask(
    title: string,
    description: string,
    options: {
      risk?: TaskRisk;
      priority?: Task['priority'];
      createdBy?: string;
      parentTaskId?: string;
      depth?: number;
      filePaths?: string[];
      tags?: string[];
    } = {}
  ): Promise<Task> {
    const risk = options.risk || this.autoDetectRisk(options.filePaths || [], title);
    const task = this.taskManager.createTask({
      title,
      description,
      risk,
      priority: options.priority || 'medium',
      createdBy: options.createdBy || 'user',
      parentTaskId: options.parentTaskId || null,
      depth: options.depth || 0,
      filePaths: options.filePaths || [],
      tags: options.tags || [],
    });

    this.eventBus.emit({
      type: 'task:created',
      timestamp: Date.now(),
      taskId: task.id,
      data: { title, risk, createdBy: options.createdBy || 'user' },
    });

    return task;
  }

  /**
   * Set a high-level goal. Uses a planning agent to break it into subtasks.
   */
  async setGoal(goalDescription: string): Promise<Task> {
    const planningTask = await this.createTask(
      `Plan: ${goalDescription}`,
      `You are a planning agent. Break this goal into concrete subtasks.\n\nGoal: ${goalDescription}\n\nRespond with a JSON array of subtasks, each with: title, description, risk (low/high), priority (low/medium/high/critical), filePaths (array), tags (array).`,
      { risk: 'low', priority: 'high', tags: ['planning'] }
    );
    return planningTask;
  }

  /**
   * Main processing loop — picks tasks from queue and dispatches to agents.
   */
  private async processQueue(): Promise<void> {
    if (!this.isRunning) return;

    const pendingTasks = this.taskManager.getPendingTasks();
    const workingAgents = this.registry.getAllAgents().filter(
      a => a.status === 'working'
    );

    if (workingAgents.length >= this.maxConcurrent) return;
    if (pendingTasks.length === 0) return;

    const slotsAvailable = this.maxConcurrent - workingAgents.length;
    const tasksToProcess = pendingTasks.slice(0, slotsAvailable);

    for (const task of tasksToProcess) {
      const roleHint = this.inferRole(task);
      const agent = this.registry.getBestAgent(roleHint);
      if (!agent) continue; // no available agents

      this.dispatchTask(task, agent.id).catch(err => {
        console.error(`[AgentOS] Failed to dispatch task ${task.id}:`, err);
      });
    }
  }

  /**
   * Dispatch a task to a specific agent.
   */
  private async dispatchTask(task: Task, agentId: string): Promise<void> {
    const agent = this.registry.getAgent(agentId);
    if (!agent) return;

    // Mark agent as working
    this.registry.updateAgentStatus(agentId, 'working');
    this.taskManager.assignTask(task.id, agentId);
    agent.currentTaskId = task.id;

    this.eventBus.emit({
      type: 'agent:working',
      timestamp: Date.now(),
      agentId,
      taskId: task.id,
    });

    try {
      // Build context
      const memory = await this.memoryManager.recall('*');
      const context: AgentContext = {
        task,
        memory,
        projectRoot: this.workspaceRoot,
        relevantFiles: [],
        agentConfig: agent.config,
      };

      // Execute via adapter
      const result = await this.router.execute(agent.config, context);

      // Process result
      await this.handleResult(task, agentId, result);

    } catch (err: any) {
      // Handle rate limits
      if (err.status === 429 || err.code === 'rate_limit_exceeded') {
        const retryAfter = parseInt(err.headers?.['retry-after'] || '60') * 1000;
        this.registry.setCooldown(agentId, retryAfter);
        this.taskManager.unassignTask(task.id);
      } else {
        this.registry.updateAgentStatus(agentId, 'error');
        agent.errorCount++;
        this.taskManager.failTask(task.id, err.message || 'Unknown error');
        this.eventBus.emit({
          type: 'agent:error',
          timestamp: Date.now(),
          agentId,
          taskId: task.id,
          data: { error: err.message },
        });
      }
    } finally {
      agent.currentTaskId = null;
      if (agent.status === 'working') {
        this.registry.updateAgentStatus(agentId, 'idle');
      }
    }
  }

  private async handleResult(task: Task, agentId: string, result: AgentResult): Promise<void> {
    // Drain energy based on token usage
    this.registry.drainEnergy(agentId, result.tokensUsed);

    // Award XP
    this.gamification.awardXP(agentId, task);

    // Process subtasks (agent-to-agent task spawning)
    if (result.subtasks.length > 0 && task.depth < this.maxTaskDepth) {
      for (const sub of result.subtasks) {
        await this.createTask(sub.title, sub.description, {
          risk: sub.risk,
          priority: sub.priority,
          createdBy: `agent:${agentId}`,
          parentTaskId: task.id,
          depth: task.depth + 1,
          filePaths: sub.filePaths,
          tags: sub.tags,
        });
      }
    }

    // Process file changes based on risk
    if (result.fileChanges.length > 0) {
      const effectiveRisk = this.resolveRisk(task.risk, result.fileChanges);

      if (effectiveRisk === 'low' && this.autoApplyLowRisk) {
        await this.applyChanges(result.fileChanges);
        this.eventBus.emit({
          type: 'file:auto-applied',
          timestamp: Date.now(),
          agentId,
          taskId: task.id,
          data: { files: result.fileChanges.map(f => f.filePath) },
        });
      } else {
        // Queue for review
        this.taskManager.moveToReview(task.id, result);
        this.eventBus.emit({
          type: 'task:review-needed',
          timestamp: Date.now(),
          agentId,
          taskId: task.id,
          data: { fileChanges: result.fileChanges },
        });
      }
    }

    // Update task as completed
    this.taskManager.completeTask(task.id, {
      success: true,
      output: result.output,
      fileChanges: result.fileChanges,
      tokensUsed: result.tokensUsed,
      subtasks: [],
    });

    // Save to memory
    await this.memoryManager.remember(
      `task:${task.id}`,
      { result: result.output, agent: agentId, timestamp: Date.now() }
    );

    this.eventBus.emit({
      type: 'agent:completed',
      timestamp: Date.now(),
      agentId,
      taskId: task.id,
      data: { tokensUsed: result.tokensUsed },
    });
  }

  /**
   * Apply file changes directly to the workspace.
   */
  private async applyChanges(changes: FileChange[]): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    for (const change of changes) {
      const fullPath = path.join(this.workspaceRoot, change.filePath);
      if (change.type === 'create' || change.type === 'modify') {
        if (change.content) {
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(fullPath, change.content);
        }
      } else if (change.type === 'delete') {
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
    }
  }

  /**
   * Approve a pending review — applies its file changes.
   */
  async approveTask(taskId: string): Promise<void> {
    const task = this.taskManager.getTask(taskId);
    if (!task || !task.result) return;
    await this.applyChanges(task.result.fileChanges);
    this.taskManager.updateTaskStatus(taskId, 'completed');
    this.eventBus.emit({
      type: 'task:approved',
      timestamp: Date.now(),
      taskId,
    });
  }

  /**
   * Reject a pending review — discards its changes.
   */
  rejectTask(taskId: string): void {
    this.taskManager.updateTaskStatus(taskId, 'cancelled');
    this.eventBus.emit({
      type: 'task:rejected',
      timestamp: Date.now(),
      taskId,
    });
  }

  /**
   * Auto-detect risk based on file paths.
   */
  private autoDetectRisk(filePaths: string[], title: string): TaskRisk {
    const lowRiskPatterns = [
      /\.md$/, /\.txt$/, /\.test\./, /\.spec\./, /\.d\.ts$/,
      /docs\//, /test\//, /tests\//, /__tests__\//,
      /README/, /CHANGELOG/, /LICENSE/,
    ];
    const titleLower = title.toLowerCase();
    if (titleLower.includes('doc') || titleLower.includes('test') || titleLower.includes('readme')) {
      return 'low';
    }
    if (filePaths.length > 0 && filePaths.every(
      fp => lowRiskPatterns.some(p => p.test(fp))
    )) {
      return 'low';
    }
    return 'high';
  }

  private resolveRisk(taskRisk: TaskRisk, changes: FileChange[]): 'low' | 'high' {
    if (taskRisk === 'high') return 'high';
    if (taskRisk === 'low') return 'low';
    // 'auto' — check file paths
    return this.autoDetectRisk(changes.map(c => c.filePath), '') as 'low' | 'high';
  }

  private inferRole(task: Task): string | undefined {
    const title = task.title.toLowerCase();
    if (task.tags.includes('planning')) return 'planning';
    if (title.includes('test')) return 'testing';
    if (title.includes('doc') || title.includes('readme')) return 'documentation';
    if (title.includes('refactor')) return 'refactoring';
    if (title.includes('review')) return 'code-review';
    return 'general';
  }

  dispose(): void {
    this.stop();
  }
}

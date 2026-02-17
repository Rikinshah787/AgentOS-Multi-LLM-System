import * as fs from 'fs';
import * as path from 'path';
import { Task, TaskResult, TaskStatus, TaskRisk, TaskPriority } from '../core/types';

/**
 * Task Manager — manages the full task lifecycle.
 * Tasks are stored in memory (Map) and periodically synced to markdown files.
 * Supports the inbox → active → review → completed pipeline.
 */
export class TaskManager {
  private tasks: Map<string, Task> = new Map();
  private taskCounter = 0;
  private tasksDir: string;

  constructor(private workspaceRoot: string) {
    this.tasksDir = path.join(workspaceRoot, 'agent_os', 'tasks');
  }

  async initialize(): Promise<void> {
    this.ensureDir();
    this.loadFromMarkdown();
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.tasksDir)) {
      fs.mkdirSync(this.tasksDir, { recursive: true });
    }
    for (const file of ['inbox.md', 'active.md', 'review.md', 'completed.md']) {
      const fpath = path.join(this.tasksDir, file);
      if (!fs.existsSync(fpath)) {
        const title = file.replace('.md', '').charAt(0).toUpperCase() + file.replace('.md', '').slice(1);
        fs.writeFileSync(fpath, `# ${title} Tasks\n\n`);
      }
    }
  }

  createTask(params: {
    title: string;
    description: string;
    risk: TaskRisk;
    priority: TaskPriority;
    createdBy: string;
    parentTaskId: string | null;
    depth: number;
    filePaths: string[];
    tags: string[];
  }): Task {
    const id = `TASK-${String(++this.taskCounter).padStart(3, '0')}`;
    const task: Task = {
      id,
      title: params.title,
      description: params.description,
      status: 'pending',
      risk: params.risk,
      priority: params.priority,
      assignedAgentId: null,
      createdBy: params.createdBy,
      parentTaskId: params.parentTaskId,
      depth: params.depth,
      created: Date.now(),
      started: null,
      completed: null,
      result: null,
      filePaths: params.filePaths,
      tags: params.tags,
    };
    this.tasks.set(id, task);
    this.syncToMarkdown();
    return task;
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  getPendingTasks(): Task[] {
    return this.getAllTasks()
      .filter(t => t.status === 'pending')
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      });
  }

  getActiveTasks(): Task[] {
    return this.getAllTasks().filter(t => t.status === 'active');
  }

  getReviewTasks(): Task[] {
    return this.getAllTasks().filter(t => t.status === 'review');
  }

  getCompletedTasks(): Task[] {
    return this.getAllTasks().filter(t => t.status === 'completed' || t.status === 'cancelled');
  }

  assignTask(taskId: string, agentId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'active';
    task.assignedAgentId = agentId;
    task.started = Date.now();
    this.syncToMarkdown();
  }

  unassignTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'pending';
    task.assignedAgentId = null;
    task.started = null;
    this.syncToMarkdown();
  }

  completeTask(taskId: string, result: TaskResult): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'completed';
    task.completed = Date.now();
    task.result = result;
    this.syncToMarkdown();
  }

  failTask(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'failed';
    task.completed = Date.now();
    task.result = {
      success: false,
      output: '',
      fileChanges: [],
      tokensUsed: 0,
      subtasks: [],
      error,
    };
    this.syncToMarkdown();
  }

  moveToReview(taskId: string, result: AgentResultLike): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'review';
    task.result = {
      success: true,
      output: result.output,
      fileChanges: result.fileChanges,
      tokensUsed: result.tokensUsed,
      subtasks: [],
    };
    this.syncToMarkdown();
  }

  updateTaskStatus(taskId: string, status: TaskStatus): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = status;
    if (status === 'completed' || status === 'cancelled') {
      task.completed = Date.now();
    }
    this.syncToMarkdown();
  }

  /**
   * Sync all tasks to markdown files for human readability.
   */
  private syncToMarkdown(): void {
    const groups: Record<string, Task[]> = {
      inbox: this.getPendingTasks(),
      active: this.getActiveTasks(),
      review: this.getReviewTasks(),
      completed: this.getCompletedTasks().slice(-50), // keep last 50
    };

    for (const [file, tasks] of Object.entries(groups)) {
      const title = file.charAt(0).toUpperCase() + file.slice(1);
      let md = `# ${title} Tasks\n\n`;
      if (tasks.length === 0) {
        md += '_No tasks._\n';
      } else {
        for (const task of tasks) {
          md += this.taskToMarkdown(task);
        }
      }
      fs.writeFileSync(path.join(this.tasksDir, `${file}.md`), md);
    }
  }

  private taskToMarkdown(task: Task): string {
    const agent = task.assignedAgentId ? task.assignedAgentId : '(none)';
    const created = new Date(task.created).toISOString();
    return `## ${task.id}: ${task.title}
- **status**: ${task.status}
- **priority**: ${task.priority}
- **risk**: ${task.risk}
- **assigned**: ${agent}
- **created-by**: ${task.createdBy}
- **created**: ${created}
- **description**: ${task.description}
${task.filePaths.length > 0 ? `- **files**: ${task.filePaths.join(', ')}\n` : ''}${task.tags.length > 0 ? `- **tags**: ${task.tags.join(', ')}\n` : ''}
`;
  }

  /**
   * Load tasks from markdown files on startup (basic parsing).
   */
  private loadFromMarkdown(): void {
    // On startup, we start fresh but load any existing task counter
    const files = ['inbox.md', 'active.md', 'review.md', 'completed.md'];
    for (const file of files) {
      const fpath = path.join(this.tasksDir, file);
      if (!fs.existsSync(fpath)) continue;
      const content = fs.readFileSync(fpath, 'utf-8');
      const taskIds = content.match(/TASK-(\d+)/g) || [];
      for (const id of taskIds) {
        const num = parseInt(id.replace('TASK-', ''));
        if (num > this.taskCounter) this.taskCounter = num;
      }
    }
  }

  dispose(): void {
    this.syncToMarkdown();
  }
}

interface AgentResultLike {
  output: string;
  fileChanges: any[];
  tokensUsed: number;
}

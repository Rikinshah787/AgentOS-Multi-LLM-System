import * as vscode from 'vscode';
import * as path from 'path';
import { TriggerConfig, TriggersConfigFile } from '../core/types';
import { EventBus } from '../core/event-bus';
import * as fs from 'fs';

/**
 * File Watcher — monitors workspace for changes and fires auto-triggers.
 * This is what enables the "vibe coding" experience: save a file,
 * agents automatically respond.
 */
export class FileWatcher {
  private triggers: TriggerConfig[] = [];
  private watchers: vscode.Disposable[] = [];
  private triggersPath: string;
  private todoRegex = /\/\/\s*TODO[:\s](.+)|#\s*TODO[:\s](.+)/gi;

  constructor(
    private workspaceRoot: string,
    private eventBus: EventBus,
    private onTriggerFired: (trigger: TriggerConfig, context: { filePath?: string; content?: string }) => void
  ) {
    this.triggersPath = path.join(workspaceRoot, 'agent_os', 'triggers.json');
  }

  async initialize(): Promise<void> {
    await this.loadTriggers();
    this.setupWatchers();
    this.watchTriggersFile();
  }

  private async loadTriggers(): Promise<void> {
    try {
      if (fs.existsSync(this.triggersPath)) {
        const raw = fs.readFileSync(this.triggersPath, 'utf-8');
        const config: TriggersConfigFile = JSON.parse(raw);
        this.triggers = config.triggers.filter(t => t.enabled !== false);
      }
    } catch (err) {
      console.error('[AgentOS] Failed to load triggers.json:', err);
    }
  }

  private setupWatchers(): void {
    // Watch for file saves
    const saveWatcher = vscode.workspace.onDidSaveTextDocument((doc) => {
      this.handleFileEvent('file:save', doc.uri.fsPath, doc.getText());
    });
    this.watchers.push(saveWatcher);

    // Watch for file creates
    const createPattern = new vscode.RelativePattern(this.workspaceRoot, '**/*');
    const fsWatcher = vscode.workspace.createFileSystemWatcher(createPattern);

    fsWatcher.onDidCreate((uri) => {
      this.handleFileEvent('file:create', uri.fsPath);
    });
    fsWatcher.onDidDelete((uri) => {
      this.handleFileEvent('file:delete', uri.fsPath);
    });
    this.watchers.push(fsWatcher);
  }

  private watchTriggersFile(): void {
    const pattern = new vscode.RelativePattern(this.workspaceRoot, 'agent_os/triggers.json');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    watcher.onDidChange(() => this.loadTriggers());
    watcher.onDidCreate(() => this.loadTriggers());
    this.watchers.push(watcher);
  }

  private handleFileEvent(event: string, filePath: string, content?: string): void {
    const relativePath = path.relative(this.workspaceRoot, filePath);

    // Skip agent_os internal files
    if (relativePath.startsWith('agent_os')) return;
    // Skip node_modules, dist, etc.
    if (relativePath.includes('node_modules') || relativePath.startsWith('dist')) return;

    // Check matching triggers
    for (const trigger of this.triggers) {
      if (trigger.event !== event) continue;

      if (trigger.pattern && !this.matchesPattern(relativePath, trigger.pattern)) {
        continue;
      }

      this.eventBus.emit({
        type: 'trigger:fired',
        timestamp: Date.now(),
        data: { trigger: trigger.action, file: relativePath, event },
      });

      this.onTriggerFired(trigger, { filePath: relativePath, content });
    }

    // Scan for TODO comments
    if (content && (event === 'file:save' || event === 'file:create')) {
      this.scanForTodos(relativePath, content);
    }
  }

  private scanForTodos(filePath: string, content: string): void {
    const todoTrigger = this.triggers.find(t => t.event === 'todo:detected');
    if (!todoTrigger) return;

    let match;
    this.todoRegex.lastIndex = 0;
    while ((match = this.todoRegex.exec(content)) !== null) {
      const todoText = (match[1] || match[2]).trim();
      this.onTriggerFired(todoTrigger, {
        filePath,
        content: todoText,
      });
    }
  }

  /**
   * Simple glob-like pattern matching.
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    const normalized = filePath.replace(/\\/g, '/');
    const regexStr = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '<<GLOBSTAR>>')
      .replace(/\*/g, '[^/]*')
      .replace(/<<GLOBSTAR>>/g, '.*');
    return new RegExp(`^${regexStr}$`).test(normalized);
  }

  dispose(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
  }
}

import * as fs from 'fs';
import * as path from 'path';

/**
 * Memory Manager — persistent memory shared across all agents.
 * File-based storage (JSON + Markdown) that lives in the project.
 * No database needed — works in any project, commits with the repo.
 */
export class MemoryManager {
  private persistentPath: string;
  private historyPath: string;
  private preferencesPath: string;
  private cache: Record<string, unknown> = {};

  constructor(private workspaceRoot: string) {
    const memDir = path.join(workspaceRoot, 'agent_os', 'memory');
    this.persistentPath = path.join(memDir, 'persistent.json');
    this.historyPath = path.join(memDir, 'history.md');
    this.preferencesPath = path.join(memDir, 'preferences.md');
  }

  async initialize(): Promise<void> {
    this.ensureFiles();
    this.loadCache();
  }

  private ensureFiles(): void {
    const dir = path.dirname(this.persistentPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.persistentPath)) {
      fs.writeFileSync(this.persistentPath, JSON.stringify({
        facts: {},
        decisions: {},
        gamification: {
          agents: {},
          achievements: [],
          globalStats: { totalTasks: 0, totalTokens: 0, totalAgentsUsed: 0, startedAt: Date.now() },
        },
      }, null, 2));
    }
    if (!fs.existsSync(this.historyPath)) {
      fs.writeFileSync(this.historyPath, '# AgentOS Activity History\n\n');
    }
    if (!fs.existsSync(this.preferencesPath)) {
      fs.writeFileSync(this.preferencesPath, `# AgentOS Preferences\n\n## Auto-Apply Rules\n- Low-risk changes: auto-apply\n- High-risk changes: require approval\n\n## Agent Preferences\n- Default planning agent: auto\n- Default review agent: auto\n`);
    }
  }

  private loadCache(): void {
    try {
      const raw = fs.readFileSync(this.persistentPath, 'utf-8');
      this.cache = JSON.parse(raw);
    } catch {
      this.cache = {};
    }
  }

  private saveCache(): void {
    fs.writeFileSync(this.persistentPath, JSON.stringify(this.cache, null, 2));
  }

  /**
   * Store a value in persistent memory.
   */
  async remember(key: string, value: unknown): Promise<void> {
    this.cache[key] = value;
    this.saveCache();
  }

  /**
   * Recall a value from memory.
   * Pass '*' to get the entire memory store.
   */
  async recall(key: string): Promise<Record<string, unknown>> {
    if (key === '*') {
      return { ...this.cache };
    }
    return { [key]: this.cache[key] ?? null };
  }

  /**
   * Append an entry to the activity history log.
   */
  async appendHistory(entry: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const line = `- **${timestamp}**: ${entry}\n`;
    fs.appendFileSync(this.historyPath, line);
  }

  /**
   * Get the gamification state from persistent memory.
   */
  getGamificationState(): any {
    return (this.cache as any).gamification || {};
  }

  /**
   * Update the gamification state in persistent memory.
   */
  setGamificationState(state: any): void {
    (this.cache as any).gamification = state;
    this.saveCache();
  }

  /**
   * Search memory for entries matching a query.
   */
  async search(query: string): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};
    const queryLower = query.toLowerCase();
    for (const [key, value] of Object.entries(this.cache)) {
      const valStr = JSON.stringify(value).toLowerCase();
      if (key.toLowerCase().includes(queryLower) || valStr.includes(queryLower)) {
        results[key] = value;
      }
    }
    return results;
  }

  dispose(): void {
    // Save any unsaved state
    this.saveCache();
  }
}

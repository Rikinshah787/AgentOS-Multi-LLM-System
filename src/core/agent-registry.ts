import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  AgentConfig, AgentState, AgentsConfigFile, AgentProvider,
} from './types';
import { EventBus } from './event-bus';

/**
 * Dynamic Agent Registry — the single source of truth for all agents.
 * Reads from agent_os/agents.json, watches for changes, hot-reloads.
 * Agents can be added via config file, dashboard UI, or command palette.
 */
export class AgentRegistry {
  private agents: Map<string, AgentState> = new Map();
  private configPath: string;
  private watcher: vscode.FileSystemWatcher | null = null;

  constructor(
    private workspaceRoot: string,
    private eventBus: EventBus
  ) {
    this.configPath = path.join(workspaceRoot, 'agent_os', 'agents.json');
  }

  async initialize(): Promise<void> {
    await this.loadAgents();
    this.watchConfigFile();
  }

  private async loadAgents(): Promise<void> {
    try {
      if (!fs.existsSync(this.configPath)) {
        return;
      }
      const raw = fs.readFileSync(this.configPath, 'utf-8');
      const config: AgentsConfigFile = JSON.parse(raw);

      const existingIds = new Set(this.agents.keys());
      const newIds = new Set(config.agents.map(a => a.id));

      // Remove agents no longer in config
      for (const id of existingIds) {
        if (!newIds.has(id)) {
          this.agents.delete(id);
          this.eventBus.emit({
            type: 'agent:removed',
            timestamp: Date.now(),
            agentId: id,
          });
        }
      }

      // Add or update agents
      for (const agentConfig of config.agents) {
        if (this.agents.has(agentConfig.id)) {
          // Update config but preserve runtime state
          const existing = this.agents.get(agentConfig.id)!;
          existing.config = agentConfig;
        } else {
          this.registerAgent(agentConfig);
        }
      }
    } catch (err) {
      console.error('[AgentOS] Failed to load agents.json:', err);
    }
  }

  private registerAgent(config: AgentConfig): void {
    const state: AgentState = {
      id: config.id,
      config,
      status: 'idle',
      energy: 100,
      maxEnergy: 100,
      xp: 0,
      level: 1,
      tasksCompleted: 0,
      tasksInProgress: 0,
      currentTaskId: null,
      lastActive: Date.now(),
      totalTokensUsed: 0,
      errorCount: 0,
      cooldownUntil: null,
    };
    this.agents.set(config.id, state);
    this.eventBus.emit({
      type: 'agent:registered',
      timestamp: Date.now(),
      agentId: config.id,
      data: { name: config.name, provider: config.provider },
    });
  }

  private watchConfigFile(): void {
    const pattern = new vscode.RelativePattern(
      this.workspaceRoot,
      'agent_os/agents.json'
    );
    this.watcher = vscode.workspace.createFileSystemWatcher(pattern);
    this.watcher.onDidChange(() => this.loadAgents());
    this.watcher.onDidCreate(() => this.loadAgents());
  }

  /**
   * Add a new agent at runtime. Writes to agents.json so it persists.
   */
  async addAgent(config: AgentConfig): Promise<void> {
    let existing: AgentsConfigFile = { agents: [] };
    try {
      if (fs.existsSync(this.configPath)) {
        existing = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      }
    } catch { /* start fresh */ }

    // Remove existing agent with same id
    existing.agents = existing.agents.filter(a => a.id !== config.id);
    existing.agents.push(config);

    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.configPath, JSON.stringify(existing, null, 2));
    // File watcher will trigger loadAgents()
  }

  /**
   * Remove an agent by id. Updates agents.json.
   */
  async removeAgent(id: string): Promise<void> {
    if (!fs.existsSync(this.configPath)) return;
    const config: AgentsConfigFile = JSON.parse(
      fs.readFileSync(this.configPath, 'utf-8')
    );
    config.agents = config.agents.filter(a => a.id !== id);
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  getAgent(id: string): AgentState | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }

  getAvailableAgents(): AgentState[] {
    return this.getAllAgents().filter(
      a => a.status === 'idle' && a.energy > 5
    );
  }

  /**
   * Find the best agent for a task based on role, energy, and level.
   */
  getBestAgent(preferredRole?: string, excludeIds?: string[]): AgentState | null {
    const available = this.getAvailableAgents().filter(
      a => !excludeIds?.includes(a.id)
    );
    if (available.length === 0) return null;

    // Score agents: role match (50pts) + energy (up to 30pts) + level (up to 20pts)
    const scored = available.map(agent => {
      let score = 0;
      if (preferredRole && agent.config.role === preferredRole) score += 50;
      score += (agent.energy / agent.maxEnergy) * 30;
      score += Math.min(agent.level * 2, 20);
      return { agent, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].agent;
  }

  updateAgentStatus(id: string, status: AgentState['status']): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    agent.status = status;
    agent.lastActive = Date.now();
    this.eventBus.emit({
      type: 'agent:status-changed',
      timestamp: Date.now(),
      agentId: id,
      data: { status },
    });
  }

  drainEnergy(id: string, tokensUsed: number): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    const energyCost = Math.ceil(tokensUsed / 1000);
    agent.energy = Math.max(0, agent.energy - energyCost);
    agent.totalTokensUsed += tokensUsed;
    this.eventBus.emit({
      type: 'agent:energy-changed',
      timestamp: Date.now(),
      agentId: id,
      data: { energy: agent.energy, tokensUsed },
    });
  }

  rechargeEnergy(id: string, amount: number): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    agent.energy = Math.min(agent.maxEnergy, agent.energy + amount);
  }

  /**
   * Recharge all agents based on their configured rates.
   * Called by a periodic timer (every minute).
   */
  rechargeAll(): void {
    for (const agent of this.agents.values()) {
      const rate = agent.config.energyRechargeRate || 1;
      this.rechargeEnergy(agent.id, rate);

      // Clear cooldown if expired
      if (agent.cooldownUntil && Date.now() > agent.cooldownUntil) {
        agent.cooldownUntil = null;
        if (agent.status === 'cooldown') {
          this.updateAgentStatus(agent.id, 'idle');
        }
      }
    }
  }

  setCooldown(id: string, durationMs: number): void {
    const agent = this.agents.get(id);
    if (!agent) return;
    agent.cooldownUntil = Date.now() + durationMs;
    this.updateAgentStatus(id, 'cooldown');
    this.eventBus.emit({
      type: 'agent:cooldown',
      timestamp: Date.now(),
      agentId: id,
      data: { durationMs },
    });
  }

  getProviderForAgent(id: string): AgentProvider | null {
    return this.agents.get(id)?.config.provider || null;
  }

  dispose(): void {
    this.watcher?.dispose();
  }
}

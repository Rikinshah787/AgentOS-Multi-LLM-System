import { Task, GamificationState, Achievement, AgentGameState } from '../core/types';
import { EventBus } from '../core/event-bus';
import { MemoryManager } from '../memory/memory-manager';

/**
 * Gamification Engine — manages XP, levels, energy, and achievements.
 * Every agent action earns XP and drains energy.
 * This is what makes the village feel alive.
 */
export class GamificationEngine {
  private state: GamificationState;

  // XP thresholds for each level
  private static readonly LEVEL_THRESHOLDS = [
    0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500,
    7500, 10000, 13000, 17000, 22000, 28000, 35000, 43000, 52000, 65000,
  ];

  // Achievement definitions
  private static readonly ACHIEVEMENTS: Achievement[] = [
    { id: 'first-blood', name: 'First Blood', description: 'Complete the first task', unlockedBy: null, unlockedAt: null },
    { id: 'speed-demon', name: 'Speed Demon', description: 'Complete a task in under 10 seconds', unlockedBy: null, unlockedAt: null },
    { id: 'team-player', name: 'Team Player', description: 'Use all registered agents at least once', unlockedBy: null, unlockedAt: null },
    { id: 'centurion', name: 'Centurion', description: 'Complete 100 tasks total', unlockedBy: null, unlockedAt: null },
    { id: 'marathon', name: 'Marathon', description: 'Use 1 million tokens', unlockedBy: null, unlockedAt: null },
    { id: 'level-10', name: 'Veteran', description: 'Reach level 10 with any agent', unlockedBy: null, unlockedAt: null },
    { id: 'multi-task', name: 'Multitasker', description: 'Have 3+ agents working simultaneously', unlockedBy: null, unlockedAt: null },
    { id: 'auto-pilot', name: 'Auto Pilot', description: 'Auto-apply 50 low-risk changes', unlockedBy: null, unlockedAt: null },
    { id: 'planner', name: 'Grand Planner', description: 'Spawn 10+ subtasks from a single goal', unlockedBy: null, unlockedAt: null },
    { id: 'streak-7', name: 'Weekly Streak', description: 'Use AgentOS 7 days in a row', unlockedBy: null, unlockedAt: null },
  ];

  constructor(
    private eventBus: EventBus,
    private memoryManager: MemoryManager,
  ) {
    const saved = memoryManager.getGamificationState();
    this.state = {
      agents: saved.agents || {},
      achievements: saved.achievements || [...GamificationEngine.ACHIEVEMENTS],
      globalStats: saved.globalStats || {
        totalTasks: 0,
        totalTokens: 0,
        totalAgentsUsed: 0,
        startedAt: Date.now(),
      },
    };
  }

  /**
   * Award XP to an agent for completing a task.
   */
  awardXP(agentId: string, task: Task): void {
    const agentState = this.getOrCreateAgentState(agentId);
    const baseXP = this.getBaseXP(task.priority);
    const speedBonus = this.getSpeedBonus(task);
    const depthBonus = task.depth > 0 ? 1.2 : 1.0; // bonus for subtasks

    const totalXP = Math.round(baseXP * speedBonus * depthBonus);
    agentState.xp += totalXP;
    agentState.totalTasksCompleted++;

    // Check for level up
    const newLevel = this.calculateLevel(agentState.xp);
    const didLevelUp = newLevel > agentState.level;
    agentState.level = newLevel;

    // Update global stats
    this.state.globalStats.totalTasks++;

    // Update streak
    const today = new Date().toISOString().split('T')[0];
    if (agentState.lastActiveDate !== today) {
      if (this.isConsecutiveDay(agentState.lastActiveDate, today)) {
        agentState.streakDays++;
      } else {
        agentState.streakDays = 1;
      }
      agentState.lastActiveDate = today;
    }

    this.save();

    // Emit events
    this.eventBus.emit({
      type: 'agent:xp-gained',
      timestamp: Date.now(),
      agentId,
      data: { xpGained: totalXP, totalXP: agentState.xp, level: agentState.level },
    });

    if (didLevelUp) {
      this.eventBus.emit({
        type: 'agent:level-up',
        timestamp: Date.now(),
        agentId,
        data: { newLevel, totalXP: agentState.xp },
      });
    }

    // Check achievements
    this.checkAchievements(agentId);
  }

  /**
   * Record token usage for an agent.
   */
  recordTokens(agentId: string, tokens: number): void {
    const agentState = this.getOrCreateAgentState(agentId);
    agentState.totalTokensUsed += tokens;
    this.state.globalStats.totalTokens += tokens;
    this.save();
  }

  getState(): GamificationState {
    return { ...this.state };
  }

  getAgentState(agentId: string): AgentGameState | null {
    return this.state.agents[agentId] || null;
  }

  getAchievements(): Achievement[] {
    return [...this.state.achievements];
  }

  private getOrCreateAgentState(agentId: string): AgentGameState {
    if (!this.state.agents[agentId]) {
      this.state.agents[agentId] = {
        xp: 0,
        level: 1,
        energy: 100,
        maxEnergy: 100,
        totalTasksCompleted: 0,
        totalTokensUsed: 0,
        streakDays: 0,
        lastActiveDate: '',
      };
      this.state.globalStats.totalAgentsUsed++;
    }
    return this.state.agents[agentId];
  }

  private getBaseXP(priority: string): number {
    switch (priority) {
      case 'critical': return 50;
      case 'high': return 30;
      case 'medium': return 20;
      case 'low': return 10;
      default: return 15;
    }
  }

  private getSpeedBonus(task: Task): number {
    if (!task.started || !task.completed) return 1.0;
    const durationSec = (task.completed - task.started) / 1000;
    if (durationSec < 10) return 2.0;
    if (durationSec < 30) return 1.5;
    if (durationSec < 60) return 1.2;
    return 1.0;
  }

  private calculateLevel(xp: number): number {
    for (let i = GamificationEngine.LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (xp >= GamificationEngine.LEVEL_THRESHOLDS[i]) {
        return i + 1;
      }
    }
    return 1;
  }

  private isConsecutiveDay(lastDate: string, today: string): boolean {
    if (!lastDate) return false;
    const last = new Date(lastDate);
    const now = new Date(today);
    const diffMs = now.getTime() - last.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays === 1;
  }

  private checkAchievements(agentId: string): void {
    const agentState = this.state.agents[agentId];
    const now = Date.now();

    for (const achievement of this.state.achievements) {
      if (achievement.unlockedBy) continue; // already unlocked

      let unlocked = false;
      switch (achievement.id) {
        case 'first-blood':
          unlocked = this.state.globalStats.totalTasks >= 1;
          break;
        case 'centurion':
          unlocked = this.state.globalStats.totalTasks >= 100;
          break;
        case 'marathon':
          unlocked = this.state.globalStats.totalTokens >= 1_000_000;
          break;
        case 'level-10':
          unlocked = agentState.level >= 10;
          break;
        case 'streak-7':
          unlocked = agentState.streakDays >= 7;
          break;
      }

      if (unlocked) {
        achievement.unlockedBy = agentId;
        achievement.unlockedAt = now;
        this.save();
      }
    }
  }

  private save(): void {
    this.memoryManager.setGamificationState(this.state);
  }
}

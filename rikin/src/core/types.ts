/**
 * Core type definitions for the AgentOS system.
 * Every agent, task, adapter, and event flows through these types.
 */

// ─── Agent Types ───────────────────────────────────────────────

export type AgentProvider =
  | 'openai-compatible'
  | 'gemini'
  | 'anthropic'
  | 'cursor-bridge'
  | 'copilot-bridge';

export type AgentStatus = 'idle' | 'working' | 'cooldown' | 'offline' | 'error';

export type AgentRole =
  | 'general'
  | 'planning'
  | 'reasoning'
  | 'code-review'
  | 'fast-draft'
  | 'inline-completion'
  | 'testing'
  | 'documentation'
  | 'refactoring';

export interface AgentConfig {
  id: string;
  name: string;
  provider: AgentProvider;
  endpoint?: string;
  apiKeyEnvVar?: string;
  model?: string;
  avatar: string;
  role: AgentRole;
  maxTokens?: number;
  energyRechargeRate?: number; // energy per minute
  mode?: string; // for cursor-bridge: 'auto' | 'commands' | 'api'
}

export interface AgentState {
  id: string;
  config: AgentConfig;
  status: AgentStatus;
  energy: number;       // 0-100
  maxEnergy: number;    // default 100
  xp: number;
  level: number;
  tasksCompleted: number;
  tasksInProgress: number;
  currentTaskId: string | null;
  lastActive: number;   // timestamp
  totalTokensUsed: number;
  errorCount: number;
  cooldownUntil: number | null; // timestamp
}

export interface AgentsConfigFile {
  agents: AgentConfig[];
}

// ─── Task Types ────────────────────────────────────────────────

export type TaskStatus = 'pending' | 'active' | 'review' | 'completed' | 'failed' | 'cancelled';
export type TaskRisk = 'low' | 'high' | 'auto';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  risk: TaskRisk;
  priority: TaskPriority;
  assignedAgentId: string | null;
  createdBy: string;       // 'user' or 'agent:<id>'
  parentTaskId: string | null; // for subtasks spawned by agents
  depth: number;           // task chain depth (0 = root)
  created: number;         // timestamp
  started: number | null;
  completed: number | null;
  result: TaskResult | null;
  filePaths: string[];     // files this task relates to
  tags: string[];
}

export interface TaskResult {
  success: boolean;
  output: string;
  fileChanges: FileChange[];
  tokensUsed: number;
  subtasks: Omit<Task, 'result'>[];  // subtasks spawned by the agent
  error?: string;
}

export interface FileChange {
  filePath: string;
  type: 'create' | 'modify' | 'delete';
  content?: string;
  diff?: string;
  risk: TaskRisk;
}

// ─── Adapter Types ─────────────────────────────────────────────

export interface AgentContext {
  task: Task;
  memory: Record<string, unknown>;
  projectRoot: string;
  relevantFiles: { path: string; content: string }[];
  agentConfig: AgentConfig;
}

export interface AgentResult {
  output: string;
  fileChanges: FileChange[];
  tokensUsed: number;
  subtasks: SubtaskDeclaration[];
  metadata?: Record<string, unknown>;
}

export interface SubtaskDeclaration {
  title: string;
  description: string;
  risk: TaskRisk;
  priority: TaskPriority;
  filePaths: string[];
  tags: string[];
}

export interface RateLimitInfo {
  isLimited: boolean;
  retryAfterMs: number | null;
  remainingRequests: number | null;
}

// ─── Event Types ───────────────────────────────────────────────

export type EventType =
  | 'agent:registered'
  | 'agent:removed'
  | 'agent:status-changed'
  | 'agent:working'
  | 'agent:completed'
  | 'agent:error'
  | 'agent:cooldown'
  | 'agent:energy-changed'
  | 'agent:xp-gained'
  | 'agent:level-up'
  | 'task:created'
  | 'task:assigned'
  | 'task:started'
  | 'task:completed'
  | 'task:failed'
  | 'task:review-needed'
  | 'task:approved'
  | 'task:rejected'
  | 'file:changed'
  | 'file:auto-applied'
  | 'memory:updated'
  | 'system:started'
  | 'system:error'
  | 'trigger:fired';

export interface AgentOSEvent {
  type: EventType;
  timestamp: number;
  agentId?: string;
  taskId?: string;
  data?: unknown;
}

// ─── Gamification Types ────────────────────────────────────────

export interface GamificationState {
  agents: Record<string, AgentGameState>;
  achievements: Achievement[];
  globalStats: GlobalStats;
}

export interface AgentGameState {
  xp: number;
  level: number;
  energy: number;
  maxEnergy: number;
  totalTasksCompleted: number;
  totalTokensUsed: number;
  streakDays: number;
  lastActiveDate: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlockedBy: string | null;  // agent id
  unlockedAt: number | null;
}

export interface GlobalStats {
  totalTasks: number;
  totalTokens: number;
  totalAgentsUsed: number;
  startedAt: number;
}

// ─── Trigger Types ─────────────────────────────────────────────

export type TriggerEvent =
  | 'file:save'
  | 'file:create'
  | 'file:delete'
  | 'todo:detected'
  | 'git:commit'
  | 'git:push'
  | 'manual';

export interface TriggerConfig {
  event: TriggerEvent;
  pattern?: string;
  action: string;
  agent: string;  // agent id or 'auto'
  risk: TaskRisk;
  enabled?: boolean;
}

export interface TriggersConfigFile {
  triggers: TriggerConfig[];
}

// ─── Skill Types ───────────────────────────────────────────────

export interface SkillDefinition {
  name: string;
  description: string;
  triggerKeywords: string[];
  promptTemplate: string;
  allowedAgents: string[];  // agent ids or ['*'] for all
  risk: TaskRisk;
}

// ─── WebSocket Message Types ───────────────────────────────────

export type WSMessageType =
  | 'state:full'        // full state snapshot
  | 'agent:update'      // single agent state change
  | 'task:update'       // single task state change
  | 'activity:log'      // new activity log entry
  | 'gamification:xp'   // XP/level change
  | 'command:addAgent'   // dashboard -> extension: add new agent
  | 'command:createTask' // dashboard -> extension: create task
  | 'command:approveTask' // dashboard -> extension: approve pending diff
  | 'command:rejectTask'  // dashboard -> extension: reject pending diff

export interface WSMessage {
  type: WSMessageType;
  payload: unknown;
  timestamp: number;
}

export interface FullStatePayload {
  agents: AgentState[];
  tasks: Task[];
  gamification: GamificationState;
  activity: ActivityLogEntry[];
}

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  agentId: string;
  agentName: string;
  type: EventType;
  message: string;
  details?: string;
}

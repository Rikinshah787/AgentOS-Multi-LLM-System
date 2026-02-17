import { create } from 'zustand';

// Mirror the server-side types for the dashboard
export interface AgentState {
  id: string;
  config: {
    id: string;
    name: string;
    provider: string;
    model?: string;
    avatar: string;
    role: string;
    endpoint?: string;
  };
  status: 'idle' | 'working' | 'cooldown' | 'offline' | 'error';
  energy: number;
  maxEnergy: number;
  xp: number;
  level: number;
  tasksCompleted: number;
  tasksInProgress: number;
  currentTaskId: string | null;
  lastActive: number;
  totalTokensUsed: number;
  errorCount: number;
  cooldownUntil: number | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  risk: string;
  priority: string;
  assignedAgentId: string | null;
  createdBy: string;
  parentTaskId: string | null;
  depth: number;
  created: number;
  started: number | null;
  completed: number | null;
  filePaths: string[];
  tags: string[];
  result?: {
    success: boolean;
    output: string;
    tokensUsed: number;
    agentName?: string;
    model?: string;
  } | null;
}

export interface ActivityEntry {
  id: string;
  timestamp: number;
  agentId: string;
  agentName: string;
  type: string;
  message: string;
  details?: string;
}

export interface GamificationState {
  agents: Record<string, { xp: number; level: number; energy: number; maxEnergy: number; totalTasksCompleted: number; totalTokensUsed: number; streakDays: number }>;
  achievements: { id: string; name: string; description: string; unlockedBy: string | null; unlockedAt: number | null }[];
  globalStats: { totalTasks: number; totalTokens: number; totalAgentsUsed: number; startedAt: number };
}

export interface MemoryEntry {
  taskId: string;
  title: string;
  agent: string;
  agentName: string;
  model: string;
  output: string;
  files: string[];
  tokensUsed: number;
  success: boolean;
  timestamp: number;
}

export interface MemoryState {
  totalRemembered: number;
  agentStats: Record<string, { totalTasks: number; totalTokens: number; lastActive: number }>;
  recent: MemoryEntry[];
}

interface DashboardStore {
  connected: boolean;
  agents: AgentState[];
  tasks: Task[];
  activity: ActivityEntry[];
  gamification: GamificationState | null;
  memory: MemoryState | null;
  autoApproveAll: boolean;

  setConnected: (connected: boolean) => void;
  setFullState: (state: { agents: AgentState[]; tasks: Task[]; gamification: GamificationState; activity: ActivityEntry[]; memory?: MemoryState; autoApproveAll?: boolean }) => void;
  updateAgent: (event: any) => void;
  updateTask: (event: any) => void;
  addActivity: (event: any) => void;
}

export const useStore = create<DashboardStore>((set) => ({
  connected: false,
  agents: [],
  tasks: [],
  activity: [],
  gamification: null,
  memory: null,
  autoApproveAll: true,

  setConnected: (connected) => set({ connected }),

  setFullState: (state) => set({
    agents: state.agents || [],
    tasks: state.tasks || [],
    gamification: state.gamification || null,
    activity: state.activity || [],
    memory: state.memory || null,
    autoApproveAll: state.autoApproveAll ?? true,
  }),

  updateAgent: (event) => set((s) => {
    if (!event.agentId) return s;
    const agents = s.agents.map(a => {
      if (a.id === event.agentId) {
        return {
          ...a,
          status: event.data?.status || a.status,
          energy: event.data?.energy ?? a.energy,
          xp: event.data?.totalXP ?? a.xp,
          level: event.data?.newLevel ?? a.level,
        };
      }
      return a;
    });
    return { agents };
  }),

  updateTask: (event) => set((s) => {
    // Re-fetch tasks on any task update (simplest approach)
    return s;
  }),

  addActivity: (event) => set((s) => {
    const entry: ActivityEntry = {
      id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: event.timestamp || Date.now(),
      agentId: event.agentId || 'system',
      agentName: event.agentId || 'System',
      type: event.type || 'unknown',
      message: event.data?.message || event.type || '',
      details: event.data ? JSON.stringify(event.data) : undefined,
    };
    return { activity: [...s.activity.slice(-99), entry] };
  }),
}));

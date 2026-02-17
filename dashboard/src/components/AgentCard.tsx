import React from 'react';
import { AgentState } from '../hooks/useAgentState';
import { EnergyBar } from './EnergyBar';

const AVATAR_MAP: Record<string, string> = {
  'robot-blue': '🤖', 'robot': '🤖', 'lightning': '⚡', 'google-star': '✨',
  'brain-purple': '🧠', 'wind': '🌀', 'llama': '🦙', 'cursor-logo': '📐',
  'copilot-logo': '🚁', 'fire': '🔥', 'star': '⭐', 'shield': '🛡️',
  'gem': '💎', 'sword': '⚔️', 'eye': '👁️',
};

const XP_LEVELS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000];

interface AgentCardProps {
  agent: AgentState;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent }) => {
  const avatar = AVATAR_MAP[agent.config.avatar] || '🤖';
  const nextLevelXP = XP_LEVELS[agent.level] || XP_LEVELS[XP_LEVELS.length - 1];
  const prevLevelXP = XP_LEVELS[agent.level - 1] || 0;
  const xpInLevel = agent.xp - prevLevelXP;
  const xpNeeded = nextLevelXP - prevLevelXP;

  return (
    <div className={`agent-card ${agent.status}`}>
      <div className="agent-level">Lv.{agent.level}</div>

      <div className="agent-header">
        <div className="agent-avatar">{avatar}</div>
        <div className="agent-info">
          <div className="agent-name">{agent.config.name}</div>
          <div className="agent-role">{agent.config.role}</div>
        </div>
        <span className={`agent-status ${agent.status}`}>
          {agent.status}
        </span>
      </div>

      <EnergyBar
        label="Energy"
        current={agent.energy}
        max={agent.maxEnergy}
        type="energy"
      />

      <EnergyBar
        label="XP"
        current={xpInLevel}
        max={xpNeeded || 100}
        type="xp"
      />

      <div className="agent-tokens">
        {agent.totalTokensUsed.toLocaleString()} tokens used
        {agent.tasksCompleted > 0 && ` · ${agent.tasksCompleted} tasks`}
      </div>

      {agent.status === 'working' && agent.currentTaskId && (
        <div style={{ fontSize: '10px', color: '#64ffda', marginTop: '4px' }}>
          Working on {agent.currentTaskId}...
        </div>
      )}

      {agent.cooldownUntil && agent.status === 'cooldown' && (
        <CooldownTimer until={agent.cooldownUntil} />
      )}
    </div>
  );
};

const CooldownTimer: React.FC<{ until: number }> = ({ until }) => {
  const [remaining, setRemaining] = React.useState(0);

  React.useEffect(() => {
    const tick = () => {
      const left = Math.max(0, until - Date.now());
      setRemaining(Math.ceil(left / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [until]);

  if (remaining <= 0) return null;
  return (
    <div style={{ fontSize: '10px', color: '#ffb86c', marginTop: '4px' }}>
      Cooldown: {remaining}s
    </div>
  );
};

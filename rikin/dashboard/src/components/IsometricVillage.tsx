import React, { useState, useEffect, useRef } from 'react';
import { AgentState } from '../hooks/useAgentState';

// Character color schemes per role
const CHAR_COLORS: Record<string, { skin: string; shirt: string; pants: string; hair: string; hat: string }> = {
  'reasoning':     { skin: '#fdd', shirt: '#9b59b6', pants: '#6c3483', hair: '#5d4e37', hat: '#8e44ad' },
  'fast-draft':    { skin: '#fdd', shirt: '#e74c3c', pants: '#922b21', hair: '#c0392b', hat: '#e74c3c' },
  'general':       { skin: '#fdd', shirt: '#3498db', pants: '#1a5276', hair: '#5d4e37', hat: '#2980b9' },
  'coding':        { skin: '#fdd', shirt: '#f39c12', pants: '#7d6608', hair: '#784212', hat: '#f1c40f' },
  'planning':      { skin: '#fdd', shirt: '#e67e22', pants: '#935116', hair: '#5d4e37', hat: '#d35400' },
  'ide-bridge':    { skin: '#fdd', shirt: '#546e7a', pants: '#37474f', hair: '#263238', hat: '#607d8b' },
  'observer':      { skin: '#fdd', shirt: '#00acc1', pants: '#006064', hair: '#4e342e', hat: '#0097a7' },
  'code-review':   { skin: '#fdd', shirt: '#43a047', pants: '#1b5e20', hair: '#3e2723', hat: '#2e7d32' },
  'testing':       { skin: '#fdd', shirt: '#ec407a', pants: '#880e4f', hair: '#5d4037', hat: '#d81b60' },
  'documentation': { skin: '#fdd', shirt: '#fdd835', pants: '#9e9d24', hair: '#4e342e', hat: '#c0ca33' },
};

const BUILDING_STYLES: Record<string, { emoji: string; name: string; color: string }> = {
  'reasoning':     { emoji: '🏰', name: 'Arcane Tower', color: '#bb86fc' },
  'fast-draft':    { emoji: '⚒️', name: 'Forge', color: '#ff6b6b' },
  'general':       { emoji: '🏠', name: 'Barracks', color: '#64ffda' },
  'coding':        { emoji: '🏗️', name: 'Workshop', color: '#ffd700' },
  'planning':      { emoji: '📜', name: 'War Room', color: '#ffb86c' },
  'ide-bridge':    { emoji: '🌉', name: 'Bridge', color: '#6272a4' },
  'observer':      { emoji: '🗼', name: 'Watchtower', color: '#8be9fd' },
  'code-review':   { emoji: '🔍', name: 'Library', color: '#50fa7b' },
  'testing':       { emoji: '⚗️', name: 'Lab', color: '#ff79c6' },
  'documentation': { emoji: '📚', name: 'Archive', color: '#f1fa8c' },
};

function getBuildingForAgent(role: string) {
  return BUILDING_STYLES[role] || BUILDING_STYLES['general'];
}

function getCharColors(role: string) {
  return CHAR_COLORS[role] || CHAR_COLORS['general'];
}

function getBuildingLevel(level: number) {
  if (level >= 8) return { size: 80, tier: 'legendary' };
  if (level >= 5) return { size: 72, tier: 'epic' };
  if (level >= 3) return { size: 64, tier: 'rare' };
  return { size: 56, tier: 'common' };
}

function getVillagePositions(count: number) {
  const positions: { x: number; y: number }[] = [];
  const centerX = 50;
  const centerY = 45;
  const rings = [
    { radius: 0, slots: 1 },
    { radius: 18, slots: 6 },
    { radius: 34, slots: 10 },
    { radius: 48, slots: 14 },
  ];
  let idx = 0;
  for (const ring of rings) {
    if (idx >= count) break;
    const slotsNeeded = Math.min(ring.slots, count - idx);
    for (let s = 0; s < slotsNeeded; s++) {
      const angle = (2 * Math.PI * s) / ring.slots - Math.PI / 2;
      positions.push({
        x: centerX + ring.radius * Math.cos(angle),
        y: centerY + ring.radius * 0.55 * Math.sin(angle),
      });
      idx++;
    }
  }
  return positions;
}

// The CSS pixel-art character component
const Villager: React.FC<{
  status: string;
  colors: { skin: string; shirt: string; pants: string; hair: string; hat: string };
  walkDelay: number;
}> = ({ status, colors, walkDelay }) => {
  const stateClass =
    status === 'working' ? 'v-working' :
    status === 'offline' ? 'v-sleeping' :
    status === 'cooldown' ? 'v-dizzy' :
    'v-idle';

  return (
    <div className={`villager ${stateClass}`} style={{ '--walk-delay': `${walkDelay}s` } as React.CSSProperties}>
      {/* Character shadow */}
      <div className="v-shadow" />

      <div className="v-body-wrap">
        {/* Hard hat */}
        <div className="v-hat" style={{ background: colors.hat }} />

        {/* Head */}
        <div className="v-head" style={{ background: colors.skin }}>
          <div className="v-eye v-eye-l" />
          <div className="v-eye v-eye-r" />
          <div className="v-mouth" />
        </div>

        {/* Torso */}
        <div className="v-torso" style={{ background: colors.shirt }}>
          <div className="v-belt" />
        </div>

        {/* Left arm */}
        <div className="v-arm v-arm-l" style={{ background: colors.skin }}>
          {status === 'working' && <div className="v-hammer">🔨</div>}
        </div>

        {/* Right arm */}
        <div className="v-arm v-arm-r" style={{ background: colors.skin }} />

        {/* Legs */}
        <div className="v-legs">
          <div className="v-leg v-leg-l" style={{ background: colors.pants }} />
          <div className="v-leg v-leg-r" style={{ background: colors.pants }} />
        </div>

        {/* Boots */}
        <div className="v-boots">
          <div className="v-boot v-boot-l" />
          <div className="v-boot v-boot-r" />
        </div>
      </div>

      {/* Working sparks */}
      {status === 'working' && (
        <div className="v-sparks">
          <span className="v-spark s1" />
          <span className="v-spark s2" />
          <span className="v-spark s3" />
        </div>
      )}

      {/* Sleeping Zzz */}
      {(status === 'offline' || status === 'cooldown') && (
        <div className="v-zzz">
          <span className="v-z z1">z</span>
          <span className="v-z z2">z</span>
          <span className="v-z z3">Z</span>
        </div>
      )}
    </div>
  );
};

interface XPPopup {
  id: string;
  x: number;
  y: number;
  amount: number;
  timestamp: number;
}

interface VillageProps {
  agents: AgentState[];
  onAddAgent: (config: any) => void;
}

export const IsometricVillage: React.FC<VillageProps> = ({ agents }) => {
  const [xpPopups, setXpPopups] = useState<XPPopup[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const prevXpRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const newPopups: XPPopup[] = [];
    const positions = getVillagePositions(agents.length);
    agents.forEach((agent, i) => {
      const prevXp = prevXpRef.current[agent.id] || 0;
      if (agent.xp > prevXp && prevXp > 0) {
        const pos = positions[i];
        if (pos) {
          newPopups.push({
            id: `xp-${agent.id}-${Date.now()}`,
            x: pos.x,
            y: pos.y - 5,
            amount: agent.xp - prevXp,
            timestamp: Date.now(),
          });
        }
      }
      prevXpRef.current[agent.id] = agent.xp;
    });
    if (newPopups.length > 0) {
      setXpPopups(prev => [...prev, ...newPopups]);
      setTimeout(() => {
        setXpPopups(prev => prev.filter(p => Date.now() - p.timestamp < 2000));
      }, 2200);
    }
  }, [agents]);

  const positions = getVillagePositions(agents.length);
  const workingCount = agents.filter(a => a.status === 'working').length;

  return (
    <div className="iso-village-wrapper">
      <div className="iso-village-header">
        <span className="iso-title">Agent Village</span>
        <span className="iso-subtitle">
          {workingCount > 0
            ? `${workingCount} agent${workingCount > 1 ? 's' : ''} working`
            : 'All quiet'}
        </span>
      </div>

      <div className="iso-village">
        {/* Ground layers */}
        <div className="iso-ground"><div className="iso-ground-pattern" /></div>

        {/* Dirt paths */}
        <svg className="iso-dirt-paths" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <filter id="roughen">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" />
              <feDisplacementMap in="SourceGraphic" scale="2" />
            </filter>
          </defs>
          <path d="M 10,50 Q 30,48 50,45 Q 70,42 90,50" stroke="rgba(120,90,50,0.15)" strokeWidth="3" fill="none" filter="url(#roughen)" />
          <path d="M 50,10 Q 48,30 45,50 Q 42,70 50,90" stroke="rgba(120,90,50,0.12)" strokeWidth="2.5" fill="none" filter="url(#roughen)" />
        </svg>

        {/* Pond */}
        <div className="iso-pond" style={{ left: '78%', top: '28%' }}>
          <div className="iso-pond-water" />
          <div className="iso-pond-ripple r1" />
          <div className="iso-pond-ripple r2" />
          <div className="iso-pond-shore" />
        </div>

        {/* Trees */}
        <div className="iso-deco iso-tree" style={{ left: '6%', top: '18%' }}>🌲</div>
        <div className="iso-deco iso-tree" style={{ left: '10%', top: '25%' }}>🌲</div>
        <div className="iso-deco iso-tree" style={{ left: '88%', top: '12%' }}>🌳</div>
        <div className="iso-deco iso-tree" style={{ left: '92%', top: '18%' }}>🌲</div>
        <div className="iso-deco iso-tree" style={{ left: '4%', top: '68%' }}>🌲</div>
        <div className="iso-deco iso-tree" style={{ left: '8%', top: '75%' }}>🌳</div>
        <div className="iso-deco iso-tree" style={{ left: '91%', top: '62%' }}>🌳</div>
        <div className="iso-deco iso-tree" style={{ left: '95%', top: '55%' }}>🌲</div>
        <div className="iso-deco iso-tree" style={{ left: '3%', top: '45%' }}>🌲</div>
        <div className="iso-deco iso-tree" style={{ left: '96%', top: '40%' }}>🌳</div>

        {/* Rocks */}
        <div className="iso-deco iso-rock" style={{ left: '14%', top: '88%' }}>🪨</div>
        <div className="iso-deco iso-rock" style={{ left: '82%', top: '82%' }}>🪨</div>
        <div className="iso-deco iso-rock" style={{ left: '20%', top: '12%' }}>🪨</div>

        {/* Flowers */}
        <div className="iso-deco iso-flower" style={{ left: '18%', top: '35%' }}>🌸</div>
        <div className="iso-deco iso-flower" style={{ left: '72%', top: '75%' }}>🌼</div>
        <div className="iso-deco iso-flower" style={{ left: '30%', top: '80%' }}>🌺</div>
        <div className="iso-deco iso-flower" style={{ left: '65%', top: '18%' }}>🌸</div>
        <div className="iso-deco iso-flower" style={{ left: '42%', top: '88%' }}>🌼</div>

        {/* Grass blade clusters */}
        {[12,25,38,55,68,75,85,8,45,62,92,33,78,18,52].map((x, i) => (
          <div key={`g${i}`} className="iso-grass-blade"
            style={{ left: `${x}%`, top: `${15 + (i * 5.2) % 72}%`, animationDelay: `${i * 0.2}s` }} />
        ))}

        {/* Paths */}
        <svg className="iso-paths" viewBox="0 0 100 100" preserveAspectRatio="none">
          {positions.map((pos, i) => {
            if (i === 0) return null;
            const center = positions[0];
            return (
              <line key={`path-${i}`}
                x1={`${center.x}%`} y1={`${center.y}%`}
                x2={`${pos.x}%`} y2={`${pos.y}%`}
                stroke="rgba(100,255,218,0.06)" strokeWidth="0.4" strokeDasharray="0.8,0.8"
              />
            );
          })}
        </svg>

        {/* Agent plots */}
        {agents.map((agent, i) => {
          const pos = positions[i];
          if (!pos) return null;
          const building = getBuildingForAgent(agent.config.role);
          const bLevel = getBuildingLevel(agent.level);
          const charColors = getCharColors(agent.config.role);
          const isWorking = agent.status === 'working';
          const isOffline = agent.status === 'offline';
          const isSelected = selectedAgent === agent.id;

          return (
            <div key={agent.id}
              className={`iso-plot ${isSelected ? 'selected' : ''}`}
              style={{ left: `${pos.x}%`, top: `${pos.y}%`, zIndex: Math.round(pos.y) }}
              onClick={() => setSelectedAgent(isSelected ? null : agent.id)}
            >
              {/* Building */}
              <div className={`iso-building ${bLevel.tier} ${isWorking ? 'working' : ''} ${isOffline ? 'offline' : ''}`}>
                <div className="iso-building-base" />
                <div className="iso-building-body">
                  <span className="iso-building-icon" style={{ fontSize: `${bLevel.size * 0.45}px` }}>
                    {building.emoji}
                  </span>
                </div>
                {isWorking && (
                  <><div className="iso-smoke s1" /><div className="iso-smoke s2" /><div className="iso-smoke s3" /></>
                )}
                <div className="iso-level-badge">{agent.level}</div>
              </div>

              {/* Real character */}
              <Villager status={agent.status} colors={charColors} walkDelay={i * 0.3} />

              {/* Overhead UI */}
              <div className="iso-overhead">
                <div className="iso-name">{agent.config.name.split('(')[0].trim()}</div>
                <div className="iso-hp-bar">
                  <div className={`iso-hp-fill ${agent.energy < 20 ? 'low' : ''}`}
                    style={{ width: `${(agent.energy / agent.maxEnergy) * 100}%` }} />
                </div>
                {isWorking && agent.currentTaskId && (
                  <div className="iso-task-label">{agent.currentTaskId}</div>
                )}
              </div>

              {/* Detail popup */}
              {isSelected && (
                <div className="iso-detail-popup" onClick={e => e.stopPropagation()}>
                  <div className="iso-detail-name">{agent.config.name}</div>
                  <div className="iso-detail-role">{agent.config.role} / {agent.config.model || 'n/a'}</div>
                  <div className="iso-detail-row"><span>Energy</span><span>{agent.energy}/{agent.maxEnergy}</span></div>
                  <div className="iso-detail-row"><span>XP</span><span>{agent.xp} (Lv.{agent.level})</span></div>
                  <div className="iso-detail-row"><span>Tasks</span><span>{agent.tasksCompleted} done</span></div>
                  <div className="iso-detail-row"><span>Tokens</span><span>{agent.totalTokensUsed.toLocaleString()}</span></div>
                  <div className="iso-detail-status" data-status={agent.status}>{agent.status.toUpperCase()}</div>
                </div>
              )}
            </div>
          );
        })}

        {/* XP Popups */}
        {xpPopups.map(popup => (
          <div key={popup.id} className="iso-xp-popup"
            style={{ left: `${popup.x}%`, top: `${popup.y}%` }}>
            +{popup.amount} XP
          </div>
        ))}
      </div>
    </div>
  );
};

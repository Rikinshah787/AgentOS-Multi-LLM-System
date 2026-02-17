import React, { useState } from 'react';
import { useStore } from './hooks/useAgentState';
import { useWebSocket } from './hooks/useWebSocket';
import { AgentVillage } from './components/AgentVillage';
import { IsometricVillage } from './components/IsometricVillage';
import { TaskBoard } from './components/TaskBoard';
import { ActivityFeed } from './components/ActivityFeed';
import { MemoryPanel } from './components/MemoryPanel';

export const App: React.FC = () => {
  const { sendMessage } = useWebSocket();
  const { connected, agents, tasks, activity, gamification, memory, autoApproveAll } = useStore();
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [villageView, setVillageView] = useState<'3d' | 'cards'>('3d');

  const handleAddAgent = (config: any) => {
    sendMessage('command:addAgent', config);
  };

  const handleToggleAutoApprove = () => {
    sendMessage('command:toggleAutoApprove', {});
  };

  const handleApproveTask = (taskId: string) => {
    sendMessage('command:approveTask', { taskId });
  };

  const handleRejectTask = (taskId: string) => {
    sendMessage('command:rejectTask', { taskId });
  };

  // Agents that can actually be called (have APIs, not bridges)
  const callableAgents = agents.filter(
    a => a.status !== 'offline' &&
    a.config.provider !== 'cursor-bridge' &&
    a.config.provider !== 'copilot-bridge'
  );

  const toggleAgent = (id: string) => {
    setSelectedAgents(prev =>
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    if (selectedAgents.length > 0) {
      // Send to specific agents (parallel)
      sendMessage('command:createTask', {
        title: taskTitle.trim(),
        description: taskDesc.trim() || taskTitle.trim(),
        agentIds: selectedAgents,
      });
    } else {
      // Auto-assign (round-robin)
      sendMessage('command:createTask', {
        title: taskTitle.trim(),
        description: taskDesc.trim() || taskTitle.trim(),
        agentId: 'auto',
      });
    }
    setTaskTitle('');
    setTaskDesc('');
  };

  const totalTokens = gamification?.globalStats?.totalTokens ?? 0;
  const totalTasks = gamification?.globalStats?.totalTasks ?? 0;
  const achievementsUnlocked = gamification?.achievements?.filter(a => a.unlockedBy)?.length ?? 0;
  const totalAchievements = gamification?.achievements?.length ?? 0;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>
          <span className="logo">AgentOS</span> Village
        </h1>

        <div className="global-stats">
          <span>Tasks: <span className="stat-value">{totalTasks}</span></span>
          <span>Tokens: <span className="stat-value">{totalTokens.toLocaleString()}</span></span>
          <span>Achievements: <span className="stat-value">{achievementsUnlocked}/{totalAchievements}</span></span>
          <span>Agents: <span className="stat-value">{agents.length}</span></span>
        </div>

        <button
          onClick={handleToggleAutoApprove}
          style={{
            padding: '6px 16px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            background: autoApproveAll ? '#64ffda' : '#ff6b6b',
            color: autoApproveAll ? '#0f0f23' : '#fff',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}>
          {autoApproveAll ? 'Auto Approve: ON' : 'Auto Approve: OFF'}
        </button>

        <div className="connection-status">
          <div className={`status-dot ${connected ? 'connected' : ''}`} />
          {connected ? 'Connected' : 'Reconnecting...'}
        </div>
      </header>

      {/* Task Creation Bar */}
      <div style={{
        padding: '12px 24px',
        background: '#1a1a3e',
        borderBottom: '1px solid rgba(100,255,218,0.1)',
        display: 'flex',
        gap: '10px',
        alignItems: 'center',
      }}>
        <form onSubmit={handleCreateTask} style={{ display: 'flex', gap: '10px', flex: 1 }}>
          <input
            value={taskTitle}
            onChange={e => setTaskTitle(e.target.value)}
            placeholder="Task: e.g. Write a hello world in Python"
            style={{
              flex: 1, padding: '10px 14px', background: '#1e1e4a',
              border: '1px solid rgba(100,255,218,0.15)', borderRadius: '8px',
              color: '#e0e0ff', fontSize: '14px', outline: 'none',
            }}
          />
          <input
            value={taskDesc}
            onChange={e => setTaskDesc(e.target.value)}
            placeholder="Details (optional)"
            style={{
              flex: 1, padding: '10px 14px', background: '#1e1e4a',
              border: '1px solid rgba(100,255,218,0.15)', borderRadius: '8px',
              color: '#e0e0ff', fontSize: '14px', outline: 'none',
            }}
          />
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setShowAgentPicker(!showAgentPicker)}
              style={{
                padding: '10px 14px', background: '#1e1e4a',
                border: '1px solid rgba(100,255,218,0.15)', borderRadius: '8px',
                color: selectedAgents.length > 0 ? '#64ffda' : '#8888bb',
                fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
                minWidth: '180px', textAlign: 'left',
              }}>
              {selectedAgents.length === 0
                ? 'Auto (round-robin) ▾'
                : `${selectedAgents.length} agent${selectedAgents.length > 1 ? 's' : ''} selected ▾`}
            </button>
            {showAgentPicker && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                background: '#1a1a3e', border: '1px solid rgba(100,255,218,0.2)',
                borderRadius: '8px', padding: '8px', zIndex: 100, minWidth: '240px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              }}>
                <div style={{ fontSize: '11px', color: '#8888bb', marginBottom: '6px', padding: '0 4px' }}>
                  Select agents to run in parallel (or none for auto):
                </div>
                {callableAgents.map(a => (
                  <label key={a.id} style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '6px 8px', borderRadius: '6px', cursor: 'pointer',
                    background: selectedAgents.includes(a.id) ? 'rgba(100,255,218,0.08)' : 'transparent',
                    fontSize: '13px', color: '#e0e0ff',
                  }}>
                    <input type="checkbox" checked={selectedAgents.includes(a.id)}
                      onChange={() => toggleAgent(a.id)}
                      style={{ accentColor: '#64ffda' }} />
                    <span>{a.config.name}</span>
                    {a.status === 'working' && <span style={{ color: '#64ffda', fontSize: '10px' }}>working</span>}
                  </label>
                ))}
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', padding: '0 4px' }}>
                  <button type="button" onClick={() => setSelectedAgents(callableAgents.map(a => a.id))}
                    style={{ fontSize: '10px', color: '#64ffda', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Select All
                  </button>
                  <button type="button" onClick={() => setSelectedAgents([])}
                    style={{ fontSize: '10px', color: '#8888bb', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '14px' }}
            onClick={() => setShowAgentPicker(false)}>
            Send {selectedAgents.length > 1 ? `to ${selectedAgents.length} agents` : ''}
          </button>
        </form>
      </div>

      <div className="dashboard-body">
        <div className="village-section">
          {/* View Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <button
              onClick={() => setVillageView('3d')}
              style={{
                padding: '5px 14px', fontSize: '12px', fontWeight: 600,
                borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: villageView === '3d' ? '#64ffda' : '#1e1e4a',
                color: villageView === '3d' ? '#0f0f23' : '#8888bb',
                transition: 'all 0.2s',
              }}>
              Village 3D
            </button>
            <button
              onClick={() => setVillageView('cards')}
              style={{
                padding: '5px 14px', fontSize: '12px', fontWeight: 600,
                borderRadius: '6px', border: 'none', cursor: 'pointer',
                background: villageView === 'cards' ? '#64ffda' : '#1e1e4a',
                color: villageView === 'cards' ? '#0f0f23' : '#8888bb',
                transition: 'all 0.2s',
              }}>
              Card View
            </button>
          </div>

          {villageView === '3d'
            ? <IsometricVillage agents={agents} onAddAgent={handleAddAgent} />
            : <AgentVillage agents={agents} onAddAgent={handleAddAgent} />
          }
        </div>

        <div className="sidebar">
          <TaskBoard
            tasks={tasks}
            onApprove={handleApproveTask}
            onReject={handleRejectTask}
          />
          <MemoryPanel memory={memory} />
          <ActivityFeed activity={activity} />
        </div>
      </div>
    </div>
  );
};

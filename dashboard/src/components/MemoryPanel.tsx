import React, { useState } from 'react';
import { MemoryState } from '../hooks/useAgentState';

interface Props {
  memory: MemoryState | null;
}

export const MemoryPanel: React.FC<Props> = ({ memory }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!memory) return null;

  const agentEntries = Object.entries(memory.agentStats || {});

  return (
    <div className="panel" style={{ marginTop: '16px' }}>
      <h3 style={{ margin: '0 0 12px', color: '#64ffda', fontSize: '14px', letterSpacing: '1px', textTransform: 'uppercase' }}>
        Shared Memory
        <span style={{ float: 'right', color: '#8888bb', fontSize: '12px', textTransform: 'none' }}>
          {memory.totalRemembered} task{memory.totalRemembered !== 1 ? 's' : ''} remembered
        </span>
      </h3>

      {agentEntries.length > 0 && (
        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px',
        }}>
          {agentEntries.map(([agentId, stats]) => (
            <div key={agentId} style={{
              background: 'rgba(100,255,218,0.06)',
              border: '1px solid rgba(100,255,218,0.12)',
              borderRadius: '6px', padding: '6px 10px', fontSize: '11px',
            }}>
              <div style={{ color: '#64ffda', fontWeight: 600 }}>{agentId}</div>
              <div style={{ color: '#8888bb' }}>
                {stats.totalTasks} tasks / {stats.totalTokens.toLocaleString()} tokens
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {memory.recent.length === 0 && (
          <div style={{ color: '#555577', fontSize: '12px', textAlign: 'center', padding: '20px' }}>
            No tasks in memory yet. Send a task to get started.
          </div>
        )}
        {memory.recent.map(entry => (
          <div
            key={entry.taskId}
            onClick={() => setExpanded(expanded === entry.taskId ? null : entry.taskId)}
            style={{
              padding: '8px 10px', marginBottom: '4px',
              background: expanded === entry.taskId ? 'rgba(100,255,218,0.06)' : 'transparent',
              borderRadius: '6px', cursor: 'pointer',
              borderLeft: `3px solid ${entry.success ? '#64ffda' : '#ff6b6b'}`,
              transition: 'background 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#e0e0ff', fontSize: '12px', fontWeight: 500 }}>
                {entry.taskId}: {entry.title}
              </span>
              <span style={{ color: '#64ffda', fontSize: '10px' }}>
                {entry.agentName}
              </span>
            </div>
            <div style={{ color: '#8888bb', fontSize: '10px', marginTop: '2px' }}>
              {entry.model} / {entry.tokensUsed} tokens
              {entry.files.length > 0 && ` / ${entry.files.join(', ')}`}
              {' / '}
              {new Date(entry.timestamp).toLocaleTimeString()}
            </div>
            {expanded === entry.taskId && (
              <div style={{
                marginTop: '8px', padding: '8px',
                background: 'rgba(0,0,0,0.3)', borderRadius: '4px',
                color: '#c0c0e0', fontSize: '11px',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: '200px', overflowY: 'auto',
              }}>
                {entry.output || '(no text output)'}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

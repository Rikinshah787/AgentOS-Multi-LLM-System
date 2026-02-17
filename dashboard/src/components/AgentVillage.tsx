import React, { useState } from 'react';
import { AgentState } from '../hooks/useAgentState';
import { AgentCard } from './AgentCard';
import { AddAgentForm } from './AddAgentForm';

interface AgentVillageProps {
  agents: AgentState[];
  onAddAgent: (config: any) => void;
}

export const AgentVillage: React.FC<AgentVillageProps> = ({ agents, onAddAgent }) => {
  const [showForm, setShowForm] = useState(false);

  const workingCount = agents.filter(a => a.status === 'working').length;
  const totalAgents = agents.length;

  return (
    <div className="village-section">
      <div className="section-title">
        Agent Village — {workingCount} working / {totalAgents} total
      </div>
      <div className="village-grid">
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
        <button className="add-agent-btn" onClick={() => setShowForm(true)}>
          + Add Agent
        </button>
      </div>
      {showForm && (
        <AddAgentForm
          onSubmit={(config) => {
            onAddAgent(config);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

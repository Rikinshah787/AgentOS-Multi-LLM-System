import React, { useState } from 'react';
import { Task } from '../hooks/useAgentState';

interface TaskBoardProps {
  tasks: Task[];
  onApprove?: (taskId: string) => void;
  onReject?: (taskId: string) => void;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ tasks, onApprove, onReject }) => {
  const pending = tasks.filter(t => t.status === 'pending');
  const active = tasks.filter(t => t.status === 'active');
  const review = tasks.filter(t => t.status === 'review');
  const completed = tasks.filter(t => t.status === 'completed' || t.status === 'cancelled' || t.status === 'failed').slice(-10);

  return (
    <div className="task-board">
      <div className="section-title">Mission Board</div>

      {review.length > 0 && (
        <TaskGroup title={`Needs Review (${review.length})`} tasks={review} type="review"
          onApprove={onApprove} onReject={onReject} />
      )}
      {active.length > 0 && (
        <TaskGroup title={`Active (${active.length})`} tasks={active} type="active" />
      )}
      {pending.length > 0 && (
        <TaskGroup title={`Pending (${pending.length})`} tasks={pending} type="pending" />
      )}
      {completed.length > 0 && (
        <TaskGroup title={`Recent (${completed.length})`} tasks={completed} type="completed" />
      )}

      {tasks.length === 0 && (
        <div className="empty-state">
          No tasks yet. Type a task above and click "Send to Agent".
        </div>
      )}
    </div>
  );
};

const TaskGroup: React.FC<{
  title: string;
  tasks: Task[];
  type: string;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}> = ({ title, tasks, type, onApprove, onReject }) => (
  <div style={{ marginBottom: '12px' }}>
    <div style={{ fontSize: '11px', color: '#8888bb', fontWeight: 600, marginBottom: '6px' }}>
      {title}
    </div>
    <div className="task-list">
      {tasks.map(task => (
        <TaskItem key={task.id} task={task} type={type} onApprove={onApprove} onReject={onReject} />
      ))}
    </div>
  </div>
);

const TaskItem: React.FC<{
  task: Task;
  type: string;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}> = ({ task, type, onApprove, onReject }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`task-item ${type}`} style={{ cursor: task.result ? 'pointer' : 'default' }}
      onClick={() => task.result && setExpanded(!expanded)}>
      <div className="task-title">
        {task.id}: {task.title}
        {task.result && (
          <span style={{ fontSize: '10px', marginLeft: '6px', opacity: 0.6 }}>
            {expanded ? '▼' : '▶'} {task.result.tokensUsed} tokens
          </span>
        )}
      </div>
      <div className="task-meta">
        <span className={`task-badge ${task.risk === 'high' ? 'high-risk' : 'low-risk'}`}>
          {task.risk} risk
        </span>
        <span>{task.priority}</span>
        {task.assignedAgentId && <span>→ {task.assignedAgentId}</span>}
        {task.result?.agentName && <span>by {task.result.agentName}</span>}
        {task.status === 'failed' && <span style={{ color: '#ff5555' }}>FAILED</span>}
      </div>

      {/* Show real model response when expanded */}
      {expanded && task.result && (
        <div style={{
          marginTop: '8px', padding: '8px', background: '#0f0f23',
          borderRadius: '6px', fontSize: '11px', lineHeight: '1.5',
          color: '#e0e0ff', maxHeight: '200px', overflow: 'auto',
          whiteSpace: 'pre-wrap', fontFamily: 'monospace',
        }}>
          {task.result.model && (
            <div style={{ color: '#64ffda', marginBottom: '4px', fontWeight: 600 }}>
              Model: {task.result.model}
            </div>
          )}
          {task.result.output}
        </div>
      )}

      {type === 'review' && onApprove && onReject && (
        <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}
          onClick={e => e.stopPropagation()}>
          <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '11px' }}
            onClick={() => onApprove(task.id)}>
            Approve
          </button>
          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '11px' }}
            onClick={() => onReject(task.id)}>
            Reject
          </button>
        </div>
      )}
    </div>
  );
};

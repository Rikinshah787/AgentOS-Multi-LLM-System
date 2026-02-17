import React, { useEffect, useRef } from 'react';
import { ActivityEntry } from '../hooks/useAgentState';

interface ActivityFeedProps {
  activity: ActivityEntry[];
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ activity }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activity.length]);

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getEventIcon = (type: string): string => {
    if (type.includes('working')) return '⚡';
    if (type.includes('completed')) return '✅';
    if (type.includes('error')) return '❌';
    if (type.includes('cooldown')) return '⏳';
    if (type.includes('xp')) return '✨';
    if (type.includes('level')) return '🎉';
    if (type.includes('task:created')) return '📋';
    if (type.includes('review')) return '👀';
    if (type.includes('approved')) return '👍';
    if (type.includes('rejected')) return '👎';
    if (type.includes('trigger')) return '🔔';
    if (type.includes('auto-applied')) return '📝';
    if (type.includes('registered')) return '🏠';
    return '📌';
  };

  return (
    <div className="activity-feed">
      <div className="section-title">Activity Feed</div>
      <div className="activity-list" ref={scrollRef}>
        {activity.length === 0 && (
          <div className="empty-state">
            No activity yet. Agents will log actions here.
          </div>
        )}
        {activity.slice(-50).map(entry => (
          <div key={entry.id} className="activity-item">
            <span className="activity-time">{formatTime(entry.timestamp)}</span>
            <span>{getEventIcon(entry.type)}</span>
            <span className="activity-msg">{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

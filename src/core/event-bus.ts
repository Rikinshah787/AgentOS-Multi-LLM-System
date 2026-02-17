import { EventEmitter } from 'events';
import { AgentOSEvent, EventType, ActivityLogEntry } from './types';

/**
 * Central event bus for all inter-component communication.
 * Every agent action, task change, and system event flows through here.
 * The dashboard WebSocket server subscribes to this to push real-time updates.
 */
export class EventBus {
  private emitter: EventEmitter;
  private activityLog: ActivityLogEntry[] = [];
  private maxLogSize = 500;
  private logCounter = 0;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  emit(event: AgentOSEvent): void {
    this.emitter.emit(event.type, event);
    this.emitter.emit('*', event); // wildcard listener for dashboard
    this.addToLog(event);
  }

  on(type: EventType | '*', handler: (event: AgentOSEvent) => void): void {
    this.emitter.on(type, handler);
  }

  off(type: EventType | '*', handler: (event: AgentOSEvent) => void): void {
    this.emitter.off(type, handler);
  }

  once(type: EventType, handler: (event: AgentOSEvent) => void): void {
    this.emitter.once(type, handler);
  }

  getActivityLog(): ActivityLogEntry[] {
    return [...this.activityLog];
  }

  getRecentActivity(count: number = 50): ActivityLogEntry[] {
    return this.activityLog.slice(-count);
  }

  clearLog(): void {
    this.activityLog = [];
  }

  private addToLog(event: AgentOSEvent): void {
    const entry: ActivityLogEntry = {
      id: `log-${++this.logCounter}`,
      timestamp: event.timestamp,
      agentId: event.agentId || 'system',
      agentName: event.agentId || 'System',
      type: event.type,
      message: this.formatMessage(event),
      details: event.data ? JSON.stringify(event.data) : undefined,
    };
    this.activityLog.push(entry);
    if (this.activityLog.length > this.maxLogSize) {
      this.activityLog = this.activityLog.slice(-this.maxLogSize);
    }
  }

  private formatMessage(event: AgentOSEvent): string {
    const agent = event.agentId || 'System';
    switch (event.type) {
      case 'agent:registered': return `${agent} joined the village`;
      case 'agent:removed': return `${agent} left the village`;
      case 'agent:working': return `${agent} started working on a task`;
      case 'agent:completed': return `${agent} completed a task`;
      case 'agent:error': return `${agent} encountered an error`;
      case 'agent:cooldown': return `${agent} is cooling down (rate limited)`;
      case 'agent:xp-gained': return `${agent} earned XP`;
      case 'agent:level-up': return `${agent} leveled up!`;
      case 'task:created': return `New task created`;
      case 'task:assigned': return `Task assigned to ${agent}`;
      case 'task:completed': return `Task completed by ${agent}`;
      case 'task:review-needed': return `Task needs review (high-risk change)`;
      case 'file:auto-applied': return `Changes auto-applied (low-risk)`;
      case 'trigger:fired': return `Auto-trigger activated`;
      default: return `${event.type}`;
    }
  }

  dispose(): void {
    this.emitter.removeAllListeners();
  }
}

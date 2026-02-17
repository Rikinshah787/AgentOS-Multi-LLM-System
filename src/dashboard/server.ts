import express from 'express';
import * as http from 'http';
import * as path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { EventBus } from '../core/event-bus';
import { AgentRegistry } from '../core/agent-registry';
import { TaskManager } from '../tasks/task-manager';
import { GamificationEngine } from '../gamification/xp-system';
import { WSMessage, FullStatePayload, AgentConfig } from '../core/types';

/**
 * Dashboard Server — Express + WebSocket at localhost:3000.
 * Serves the React dashboard and pushes real-time state updates.
 * This is how the user sees the village from the browser.
 */
export class DashboardServer {
  private app: express.Application;
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  constructor(
    private port: number,
    private eventBus: EventBus,
    private registry: AgentRegistry,
    private taskManager: TaskManager,
    private gamification: GamificationEngine,
    private onAddAgent: (config: AgentConfig) => Promise<void>,
    private onCreateTask: (title: string, description: string) => Promise<void>,
    private onApproveTask: (taskId: string) => Promise<void>,
    private onRejectTask: (taskId: string) => void,
  ) {
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Serve static React dashboard build
    const dashboardPath = path.join(__dirname, '..', '..', 'dashboard', 'dist');
    this.app.use(express.static(dashboardPath));
    this.app.use(express.json());

    // API endpoints for non-WebSocket clients
    this.app.get('/api/state', (_req, res) => {
      res.json(this.getFullState());
    });

    this.app.get('/api/agents', (_req, res) => {
      res.json(this.registry.getAllAgents());
    });

    this.app.get('/api/tasks', (_req, res) => {
      res.json(this.taskManager.getAllTasks());
    });

    this.app.get('/api/activity', (_req, res) => {
      res.json(this.eventBus.getRecentActivity(100));
    });

    // SPA fallback
    this.app.get('*', (_req, res) => {
      res.sendFile(path.join(dashboardPath, 'index.html'));
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.app);
      this.wss = new WebSocketServer({ server: this.server });

      this.wss.on('connection', (ws) => {
        this.clients.add(ws);
        // Send full state on connect
        this.sendTo(ws, { type: 'state:full', payload: this.getFullState(), timestamp: Date.now() });

        ws.on('message', (data) => {
          try {
            const msg: WSMessage = JSON.parse(data.toString());
            this.handleClientMessage(msg);
          } catch (err) {
            console.error('[AgentOS Dashboard] Invalid message:', err);
          }
        });

        ws.on('close', () => {
          this.clients.delete(ws);
        });
      });

      // Subscribe to all events and broadcast to clients
      this.eventBus.on('*', (event) => {
        const msg: WSMessage = {
          type: this.eventToWSType(event.type),
          payload: event,
          timestamp: event.timestamp,
        };
        this.broadcast(msg);
      });

      this.server.listen(this.port, () => {
        console.log(`[AgentOS] Dashboard running at http://localhost:${this.port}`);
        resolve();
      });

      this.server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[AgentOS] Port ${this.port} in use, trying ${this.port + 1}`);
          this.port++;
          this.server!.listen(this.port);
        } else {
          reject(err);
        }
      });
    });
  }

  private handleClientMessage(msg: WSMessage): void {
    switch (msg.type) {
      case 'command:addAgent': {
        const config = msg.payload as AgentConfig;
        this.onAddAgent(config).catch(console.error);
        break;
      }
      case 'command:createTask': {
        const { title, description } = msg.payload as { title: string; description: string };
        this.onCreateTask(title, description).catch(console.error);
        break;
      }
      case 'command:approveTask': {
        const { taskId } = msg.payload as { taskId: string };
        this.onApproveTask(taskId).catch(console.error);
        break;
      }
      case 'command:rejectTask': {
        const { taskId } = msg.payload as { taskId: string };
        this.onRejectTask(taskId);
        break;
      }
    }
  }

  private getFullState(): FullStatePayload {
    return {
      agents: this.registry.getAllAgents(),
      tasks: this.taskManager.getAllTasks(),
      gamification: this.gamification.getState(),
      activity: this.eventBus.getRecentActivity(100),
    };
  }

  private eventToWSType(eventType: string): any {
    if (eventType.startsWith('agent:')) return 'agent:update';
    if (eventType.startsWith('task:')) return 'task:update';
    if (eventType.startsWith('file:')) return 'task:update';
    return 'activity:log';
  }

  private sendTo(ws: WebSocket, msg: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: WSMessage): void {
    const data = JSON.stringify(msg);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  getPort(): number {
    return this.port;
  }

  dispose(): void {
    this.wss?.close();
    this.server?.close();
    this.clients.clear();
  }
}

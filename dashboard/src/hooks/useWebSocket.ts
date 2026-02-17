import { useEffect, useRef, useCallback } from 'react';
import { useStore } from './useAgentState';

/**
 * WebSocket hook — connects to the AgentOS extension server.
 * Automatically reconnects on disconnect.
 * Pushes all state updates to Zustand store.
 */
export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const { setFullState, updateAgent, updateTask, addActivity, setConnected } = useStore();

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In dev mode (Vite on 3001), connect to the extension server on 3000.
    // In production (served by extension on 3000), use same host.
    const host = window.location.port === '3001' ? 'localhost:3000' : window.location.host;
    const wsUrl = `${protocol}//${host}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        // The server sends state:full after every action,
        // so always use it as the source of truth.
        if (msg.type === 'state:full') {
          setFullState(msg.payload);
        } else if (msg.payload?.agents && msg.payload?.tasks) {
          // Some messages piggyback full state
          setFullState(msg.payload);
        }
        // Activity log events add incrementally (for real-time feel)
        if (msg.type === 'activity:log' && msg.payload) {
          addActivity(msg.payload);
        }
      } catch (err) {
        console.error('[Dashboard] Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect after 3 seconds
      reconnectTimerRef.current = window.setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [setFullState, updateAgent, updateTask, addActivity, setConnected]);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [connect]);

  return { sendMessage };
}

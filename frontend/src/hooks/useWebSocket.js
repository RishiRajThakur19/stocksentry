import { useEffect, useRef, useState, useCallback } from 'react';

export const useWebSocket = (onMessageCallback) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const heartbeatIntervalRef = useRef(null);
  const retryCountRef = useRef(0);

  const getWebSocketUrl = () => {
    // 1. Explicit Vite environment variable override
    if (import.meta.env.VITE_WS_URL) {
      return import.meta.env.VITE_WS_URL;
    }

    const isSecure = window.location.protocol === 'https:';
    const wsProtocol = isSecure ? 'wss:' : 'ws:';

    // 2. In production or behind reverse proxy (Caddy / Nginx)
    if (
      import.meta.env.PROD ||
      window.location.port === '80' ||
      window.location.port === '443' ||
      window.location.port === '8080' ||
      window.location.hostname !== 'localhost'
    ) {
      return `${wsProtocol}//${window.location.host}/ws`;
    }

    // 3. Local Vite dev server fallback to FastAPI port 8000
    return 'ws://localhost:8000/ws';
  };

  const connect = useCallback(() => {
    try {
      const wsUrl = getWebSocketUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        retryCountRef.current = 0; // reset retry counter upon successful connection

        // Setup 25s ping heartbeat to prevent proxy connection timeouts
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
          }
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ACK') return; // ignore heartbeat acknowledgments
          if (onMessageCallback) {
            onMessageCallback(data);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message payload:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);

        // Exponential backoff reconnect: 1.5s, 3s, 6s... max 30s
        const backoffMs = Math.min(1500 * Math.pow(1.5, retryCountRef.current), 30000);
        retryCountRef.current += 1;

        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, backoffMs);
      };

      ws.onerror = (err) => {
        console.warn('WebSocket connection error. Attempting reconnection...', err);
        ws.close();
      };
    } catch (e) {
      console.error('Failed to initiate WebSocket:', e);
    }
  }, [onMessageCallback]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected };
};

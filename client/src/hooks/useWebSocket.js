import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';

/**
 * Custom hook for resilient WebSocket connectivity with auto-reconnect and room subscription.
 *
 * @param {string[]} rooms - Rooms to automatically subscribe to (e.g. ['clinic:123', 'doctor:456'])
 * @param {Function} onEvent - Callback function triggered on incoming events: (event, payload) => void
 */
export const useWebSocket = (rooms = [], onEvent) => {
  const { token } = useAuth();
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const backoffDelayRef = useRef(1000); // Start at 1s, backoff up to 8s
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  const connect = useCallback(() => {
    if (!token) return;

    try {
      const socketUrl = `${WS_BASE_URL}?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(socketUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        backoffDelayRef.current = 1000; // Reset backoff

        // Subscribe to initial rooms
        rooms.forEach((room) => {
          socket.send(JSON.stringify({ action: 'SUBSCRIBE', room }));
        });
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          if (onEvent && data.event) {
            onEvent(data.event, data.payload);
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse incoming message:', err);
        }
      };

      socket.onclose = () => {
        setIsConnected(false);
        // Exponential backoff reconnect
        const nextDelay = Math.min(backoffDelayRef.current * 2, 8000);
        backoffDelayRef.current = nextDelay;
        reconnectTimeoutRef.current = setTimeout(connect, nextDelay);
      };

      socket.onerror = (err) => {
        console.error('[WebSocket Error]', err);
        socket.close();
      };
    } catch (err) {
      console.error('[WebSocket Connection Error]', err);
    }
  }, [token, rooms, onEvent]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const subscribe = useCallback((room) => {
    send({ action: 'SUBSCRIBE', room });
  }, [send]);

  const unsubscribe = useCallback((room) => {
    send({ action: 'UNSUBSCRIBE', room });
  }, [send]);

  return {
    isConnected,
    lastMessage,
    send,
    subscribe,
    unsubscribe,
  };
};

export default useWebSocket;

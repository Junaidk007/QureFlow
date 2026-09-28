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
  const isUnmountedRef = useRef(false);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);

  // Keep references to latest rooms and callback to avoid reconnect cycles
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const subscribedRoomsRef = useRef(new Set());

  const connect = useCallback(() => {
    if (isUnmountedRef.current || !token) return;

    // Avoid duplicate connections if already open or connecting
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.CONNECTING ||
        wsRef.current.readyState === WebSocket.OPEN)
    ) {
      return;
    }

    try {
      const socketUrl = `${WS_BASE_URL}?token=${encodeURIComponent(token)}`;
      const socket = new WebSocket(socketUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (isUnmountedRef.current) {
          socket.close();
          return;
        }
        setIsConnected(true);
        backoffDelayRef.current = 1000; // Reset backoff

        // Subscribe to initial rooms
        subscribedRoomsRef.current.clear();
        (roomsRef.current || []).forEach((room) => {
          if (room) {
            socket.send(JSON.stringify({ action: 'SUBSCRIBE', room }));
            subscribedRoomsRef.current.add(room);
          }
        });
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);

          if (onEventRef.current && data.event) {
            onEventRef.current(data.event, data.payload);
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse incoming message:', err);
        }
      };

      socket.onclose = () => {
        if (isUnmountedRef.current) return;
        setIsConnected(false);
        subscribedRoomsRef.current.clear();

        // Exponential backoff reconnect
        const nextDelay = Math.min(backoffDelayRef.current * 2, 8000);
        backoffDelayRef.current = nextDelay;
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, nextDelay);
      };

      socket.onerror = (err) => {
        console.error('[WebSocket Error]', err);
        // Note: browser triggers onclose automatically
      };
    } catch (err) {
      console.error('[WebSocket Connection Error]', err);
    }
  }, [token]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (wsRef.current) {
        // Clear listeners to avoid onclose trigger when intentionally tearing down
        wsRef.current.onopen = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
      subscribedRoomsRef.current.clear();
    };
  }, [connect]);

  // Handle room subscriptions dynamically without reconnecting
  const roomsKey = Array.isArray(rooms) ? [...rooms].sort().join(',') : '';

  useEffect(() => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    const currentRooms = subscribedRoomsRef.current;
    const targetRooms = new Set((rooms || []).filter(Boolean));

    // Unsubscribe from rooms no longer in target
    currentRooms.forEach((room) => {
      if (!targetRooms.has(room)) {
        socket.send(JSON.stringify({ action: 'UNSUBSCRIBE', room }));
        currentRooms.delete(room);
      }
    });

    // Subscribe to new rooms
    targetRooms.forEach((room) => {
      if (!currentRooms.has(room)) {
        socket.send(JSON.stringify({ action: 'SUBSCRIBE', room }));
        currentRooms.add(room);
      }
    });
  }, [roomsKey]);

  const send = useCallback((data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const subscribe = useCallback(
    (room) => {
      if (room) {
        subscribedRoomsRef.current.add(room);
        send({ action: 'SUBSCRIBE', room });
      }
    },
    [send]
  );

  const unsubscribe = useCallback(
    (room) => {
      if (room) {
        subscribedRoomsRef.current.delete(room);
        send({ action: 'UNSUBSCRIBE', room });
      }
    },
    [send]
  );

  return {
    isConnected,
    lastMessage,
    send,
    subscribe,
    unsubscribe,
  };
};

export default useWebSocket;

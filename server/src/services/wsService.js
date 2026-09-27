const { WebSocketServer, WebSocket } = require('ws');
const url = require('url');
const { verifyJWT } = require('./sessionService');

class WsService {
  constructor() {
    this.wss = null;
    // Map of roomName -> Set of WebSocket instances
    this.rooms = new Map();
    // Map of WebSocket -> Set of roomNames (for fast cleanup on disconnect)
    this.clientRooms = new Map();
  }

  /**
   * Initialize WebSocket server and attach to existing HTTP server
   * @param {import('http').Server} server
   */
  init(server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    // Heartbeat cleanup interval (every 30 seconds)
    const interval = setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          this.cleanupClient(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);

    this.wss.on('close', () => {
      clearInterval(interval);
    });

    console.log('[WebSocket] Server initialized and listening for connections');
  }

  /**
   * Handle incoming connection with optional query param token authentication
   */
  handleConnection(ws, req) {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    this.clientRooms.set(ws, new Set());

    // Parse query params (e.g. ?token=...)
    try {
      const parsedUrl = url.parse(req.url, true);
      const token = parsedUrl.query.token;

      if (token) {
        const decoded = verifyJWT(token);
        ws.user = decoded;
        // Automatically join user's private patient channel if patient
        if (decoded.sub) {
          this.joinRoom(ws, `patient:${decoded.sub}`);
        }
        // If staff member, join their clinic room automatically
        if (decoded.clinicId) {
          this.joinRoom(ws, `clinic:${decoded.clinicId}`);
        }
        // If doctor, join doctor desk room automatically
        if (decoded.role === 'DOCTOR') {
          this.joinRoom(ws, `doctor:${decoded.sub}`);
        }
      }
    } catch (err) {
      // Allow unauthenticated connection or send auth error
      ws.send(
        JSON.stringify({
          event: 'AUTH_WARNING',
          payload: { message: 'WS connected as guest or token verification failed' },
        })
      );
    }

    // Message handler
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleMessage(ws, data);
      } catch (err) {
        ws.send(JSON.stringify({ event: 'ERROR', payload: { message: 'Invalid JSON message payload' } }));
      }
    });

    // Cleanup on disconnect
    ws.on('close', () => {
      this.cleanupClient(ws);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket Client Error]', err.message);
      this.cleanupClient(ws);
    });

    // Send welcome confirmation
    ws.send(
      JSON.stringify({
        event: 'CONNECTED',
        payload: {
          message: 'Connected to QureFlow Real-Time Queue Engine',
          user: ws.user ? { sub: ws.user.sub, role: ws.user.role } : null,
          timestamp: new Date().toISOString(),
        },
      })
    );
  }

  /**
   * Handle incoming message actions (e.g. SUBSCRIBE, UNSUBSCRIBE)
   */
  handleMessage(ws, data) {
    const { action, room } = data;

    if (action === 'SUBSCRIBE' && room) {
      this.joinRoom(ws, room);
      ws.send(JSON.stringify({ event: 'SUBSCRIBED', payload: { room } }));
    } else if (action === 'UNSUBSCRIBE' && room) {
      this.leaveRoom(ws, room);
      ws.send(JSON.stringify({ event: 'UNSUBSCRIBED', payload: { room } }));
    } else if (action === 'PING') {
      ws.send(JSON.stringify({ event: 'PONG', timestamp: new Date().toISOString() }));
    }
  }

  /**
   * Subscribe socket to a room
   */
  joinRoom(ws, room) {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room).add(ws);

    if (this.clientRooms.has(ws)) {
      this.clientRooms.get(ws).add(room);
    }
  }

  /**
   * Unsubscribe socket from a room
   */
  leaveRoom(ws, room) {
    if (this.rooms.has(room)) {
      this.rooms.get(room).delete(ws);
      if (this.rooms.get(room).size === 0) {
        this.rooms.delete(room);
      }
    }
    if (this.clientRooms.has(ws)) {
      this.clientRooms.get(ws).delete(room);
    }
  }

  /**
   * Clean up all room memberships when client closes
   */
  cleanupClient(ws) {
    const subscribedRooms = this.clientRooms.get(ws);
    if (subscribedRooms) {
      subscribedRooms.forEach((room) => {
        if (this.rooms.has(room)) {
          this.rooms.get(room).delete(ws);
          if (this.rooms.get(room).size === 0) {
            this.rooms.delete(room);
          }
        }
      });
      this.clientRooms.delete(ws);
    }
  }

  /**
   * Broadcast an event to all connected sockets in a specified room
   * @param {string} room - e.g. "clinic:123", "doctor:456", "patient:789"
   * @param {string} event - e.g. "QUEUE_UPDATED", "VISIT_CALLED"
   * @param {Object} payload - event payload data
   */
  emit(room, event, payload = {}) {
    const message = JSON.stringify({
      event,
      room,
      payload,
      timestamp: new Date().toISOString(),
    });

    const targetSockets = this.rooms.get(room);
    if (targetSockets && targetSockets.size > 0) {
      targetSockets.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }

  // Helper convenience methods
  broadcastQueueUpdate(clinicId, doctorId, data) {
    if (clinicId) this.emit(`clinic:${clinicId}`, 'QUEUE_UPDATED', data);
    if (doctorId) this.emit(`doctor:${doctorId}`, 'QUEUE_UPDATED', data);
  }

  notifyPatientCall(patientId, data) {
    this.emit(`patient:${patientId}`, 'VISIT_CALLED', data);
  }

  notifyPatientCompleted(patientId, data) {
    this.emit(`patient:${patientId}`, 'VISIT_COMPLETED', data);
  }

  broadcastDoctorStatus(clinicId, doctorId, statusData) {
    if (clinicId) this.emit(`clinic:${clinicId}`, 'DOCTOR_STATUS_CHANGED', statusData);
    if (doctorId) this.emit(`doctor:${doctorId}`, 'DOCTOR_STATUS_CHANGED', statusData);
  }
}

const wsService = new WsService();
module.exports = wsService;

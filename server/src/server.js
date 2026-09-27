require('dotenv').config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const wsService = require('./services/wsService');

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  // Connect to MongoDB
  await connectDB();

  // Create HTTP Server
  const server = http.createServer(app);

  // Initialize WebSocket engine attached to HTTP server
  wsService.init(server);

  server.listen(PORT, () => {
    console.log(`[QureFlow Server] Running on http://localhost:${PORT}`);
    console.log(`[QureFlow API] Health endpoint at http://localhost:${PORT}/api/v1/health`);
    console.log(`[QureFlow WS] WebSocket ready at ws://localhost:${PORT}`);
  });

  // Graceful shutdown handling
  const shutdown = () => {
    console.log('\n[QureFlow Server] Shutting down gracefully...');
    server.close(() => {
      console.log('[QureFlow Server] Closed all HTTP and WebSocket connections');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
};

startServer();

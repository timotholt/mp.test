// Simple Colyseus server (CommonJS) - authoritative backend
// Run with: npm run server
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const http = require('http');
const { Server } = require('colyseus');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const { NethackRoom } = require('./rooms/NethackRoom');

const PORT = process.env.PORT || 2567;

// Create a basic Node HTTP server and attach Colyseus transport
const httpServer = http.createServer();
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// Define our authoritative room. We filter by gameId to group instances by game.
gameServer.define('nethack', NethackRoom).filterBy(['gameId']);

httpServer.listen(PORT, () => {
  console.log(`Colyseus listening on ws://localhost:${PORT}`);
});

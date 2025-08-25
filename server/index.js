// Simple Colyseus server (CommonJS) - authoritative backend
// Run with: npm run server
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const http = require('http');
const { URL } = require('url');
const { verifySupabaseAccessToken } = require('./auth/verify');
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const { Server } = require('colyseus');
const { WebSocketTransport } = require('@colyseus/ws-transport');
const { NethackRoom } = require('./rooms/NethackRoom');
const { LobbyRoom } = require('./rooms/LobbyRoom');

const PORT = process.env.PORT || 2567;

// Create a basic Node HTTP server with minimal REST endpoints and attach Colyseus transport
const httpServer = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    // CORS for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (u.pathname === '/auth/verify' && req.method === 'GET') {
      // Accept token via Authorization: Bearer <token> or access_token query string
      const auth = req.headers['authorization'] || '';
      const b = auth.startsWith('Bearer ')? auth.slice(7) : '';
      const token = b || u.searchParams.get('access_token') || '';
      if (!token) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'missing_token' })); return; }
      try {
        const v = await verifySupabaseAccessToken(token);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, userId: v.userId, email: v.email, role: v.role }));
      } catch (e) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'invalid_token' }));
      }
      return;
    }

    if (u.pathname === '/auth/identities' && req.method === 'GET') {
      const email = u.searchParams.get('email') || '';
      if (!email) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'missing_email' })); return; }
      if (!SUPABASE_URL || !SERVICE_KEY) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'server_not_configured' })); return; }
      try {
        const url = new URL('/auth/v1/admin/users', SUPABASE_URL);
        url.searchParams.set('email', email);
        if (typeof fetch !== 'function') throw new Error('fetch_unavailable');
        const r = await fetch(url, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
        if (!r.ok) { throw new Error(`admin_users_http_${r.status}`); }
        const j = await r.json();
        const users = Array.isArray(j?.users) ? j.users : (Array.isArray(j) ? j : []);
        const providers = new Set();
        users.forEach(u => {
          const ids = Array.isArray(u?.identities) ? u.identities : [];
          ids.forEach(id => { if (id?.provider) providers.add(String(id.provider)); });
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, providers: Array.from(providers) }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'admin_lookup_failed' }));
      }
      return;
    }

    // Default 404 for REST, but keep server alive for WS
    if (u.pathname.startsWith('/auth/')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'not_found' }));
      return;
    }

    // For all other paths, let Colyseus WS upgrade handle it
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } catch (e) {
    try {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'server_error' }));
    } catch (_) {}
  }
});
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// Define our authoritative room. We filter by gameId to group instances by game.
gameServer.define('nethack', NethackRoom).filterBy(['gameId']);
// Real-time lobby room broadcasting available rooms and lobby players
gameServer.define('lobby', LobbyRoom);

httpServer.listen(PORT, () => {
  console.log(`Colyseus listening on ws://localhost:${PORT}`);
});

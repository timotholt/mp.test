// PresenceHub singleton: tracks userId -> lastSeen, status (green/yellow/red), and ping (ms) + net tier
// Plain JS (CommonJS)

const GREEN_MS = 10000;  // <=10s
const YELLOW_MS = 20000; // 10-20s
// >20s -> red

class PresenceHub {
  constructor() {
    this.users = new Map(); // userId -> { lastSeen: number, status: 'green'|'yellow'|'red', pingMs: number, net: 'green'|'yellow'|'red' }
    this._timer = null;
    this.startSweep();
  }

  now() { return Date.now(); }

  // Mark a heartbeat for a given user
  beat(userId) {
    if (!userId) return;
    const id = String(userId);
    const u = this.users.get(id) || { lastSeen: 0, status: 'red', pingMs: 0, net: 'red' };
    u.lastSeen = this.now();
    // Immediate optimistic green
    u.status = 'green';
    this.users.set(id, u);
  }

  // Explicit state transitions for join/leave
  setOnline(userId) { this.beat(userId); }

  setOffline(userId) {
    if (!userId) return;
    const id = String(userId);
    const u = this.users.get(id) || { lastSeen: 0, status: 'red', pingMs: 0, net: 'red' };
    u.status = 'red';
    // keep lastSeen as-is for debugging
    this.users.set(id, u);
  }

  get(userId) {
    if (!userId) return { lastSeen: 0, status: 'red' };
    const id = String(userId);
    const u = this.users.get(id);
    if (!u) return { lastSeen: 0, status: 'red', pingMs: 0, net: 'red' };
    return { lastSeen: u.lastSeen | 0, status: u.status || 'red', pingMs: (u.pingMs | 0) || 0, net: u.net || 'red' };
  }

  getStatus(userId) { return this.get(userId).status; }

  // Update and derive ping and quality tier
  setPing(userId, rttMs) {
    if (!userId) return;
    const id = String(userId);
    const u = this.users.get(id) || { lastSeen: 0, status: 'red', pingMs: 0, net: 'red' };
    const ms = Math.max(0, Number(rttMs) || 0);
    const prev = (u.pingMs | 0) || 0;
    const smoothed = prev ? Math.round(prev * 0.7 + ms * 0.3) : ms;
    u.pingMs = smoothed | 0;
    u.net = smoothed <= 60 ? 'green' : (smoothed <= 120 ? 'yellow' : 'red');
    this.users.set(id, u);
  }

  getPing(userId) { return (this.get(userId).pingMs | 0) || 0; }
  getNet(userId) { return this.get(userId).net || 'red'; }

  startSweep() {
    if (this._timer) return;
    this._timer = setInterval(() => {
      const now = this.now();
      this.users.forEach((u, id) => {
        const dt = now - (u.lastSeen | 0);
        let status = 'red';
        if (dt <= GREEN_MS) status = 'green';
        else if (dt <= YELLOW_MS) status = 'yellow';
        else status = 'red';
        if (u.status !== status) u.status = status;
      });
    }, 5000);
    try { this._timer.unref && this._timer.unref(); } catch (_) {}
  }
}

// Export a singleton instance
module.exports = new PresenceHub();

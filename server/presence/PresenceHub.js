// PresenceHub singleton: tracks userId -> lastSeen and status (green/yellow/red)
// Plain JS (CommonJS)

const GREEN_MS = 10000;  // <=10s
const YELLOW_MS = 20000; // 10-20s
// >20s -> red

class PresenceHub {
  constructor() {
    this.users = new Map(); // userId -> { lastSeen: number, status: 'green'|'yellow'|'red' }
    this._timer = null;
    this.startSweep();
  }

  now() { return Date.now(); }

  // Mark a heartbeat for a given user
  beat(userId) {
    if (!userId) return;
    const id = String(userId);
    const u = this.users.get(id) || { lastSeen: 0, status: 'red' };
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
    const u = this.users.get(id) || { lastSeen: 0, status: 'red' };
    u.status = 'red';
    // keep lastSeen as-is for debugging
    this.users.set(id, u);
  }

  get(userId) {
    if (!userId) return { lastSeen: 0, status: 'red' };
    const id = String(userId);
    const u = this.users.get(id);
    if (!u) return { lastSeen: 0, status: 'red' };
    return { lastSeen: u.lastSeen | 0, status: u.status || 'red' };
  }

  getStatus(userId) { return this.get(userId).status; }

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

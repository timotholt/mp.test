// Supabase persistence for game snapshots (Node, CommonJS)
// Uses service key for server writes. Safe no-op if env or client unavailable.

const URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

let _client = null;
async function getClient() {
  if (!URL || !SERVICE_KEY) return null;
  if (_client) return _client;
  try {
    const mod = await import('@supabase/supabase-js');
    const createClient = mod?.createClient || (mod.default && mod.default.createClient);
    if (!createClient) throw new Error('createClient not found');
    _client = createClient(URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { 'x-application-name': 'mp.test-server' } }
    });
    return _client;
  } catch (e) {
    console.warn('[persistence] supabase client unavailable; skipping persistence');
    return null;
  }
}

async function saveSnapshot(gameId, data, retention = 3) {
  const client = await getClient();
  if (!client) return null;
  try {
    const insert = [{ game_id: String(gameId), data: data }];
    const { data: rows, error } = await client
      .from('game_state_snapshots')
      .insert(insert)
      .select('id, created_at')
      .single();
    if (error) throw error;

    // Retention cleanup: keep most recent `retention` rows
    const keep = Math.max(0, retention | 0);
    if (keep >= 0) {
      const { data: oldRows, error: selErr } = await client
        .from('game_state_snapshots')
        .select('id, created_at')
        .eq('game_id', String(gameId))
        .order('created_at', { ascending: false })
        .range(keep, 1000);
      if (!selErr && Array.isArray(oldRows) && oldRows.length) {
        const ids = oldRows.map(r => r.id).filter(Boolean);
        if (ids.length) {
          await client.from('game_state_snapshots').delete().in('id', ids);
        }
      }
    }
    return rows;
  } catch (e) {
    console.warn('[persistence] saveSnapshot failed', e);
    return null;
  }
}

async function loadLatestSnapshot(gameId) {
  const client = await getClient();
  if (!client) return null;
  try {
    const { data: rows, error } = await client
      .from('game_state_snapshots')
      .select('id, created_at, data')
      .eq('game_id', String(gameId))
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    if (Array.isArray(rows) && rows[0]) return rows[0];
    return null;
  } catch (e) {
    console.warn('[persistence] loadLatestSnapshot failed', e);
    return null;
  }
}

module.exports = { saveSnapshot, loadLatestSnapshot };

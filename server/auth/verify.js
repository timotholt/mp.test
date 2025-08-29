// Supabase JWT verification helper (CommonJS with dynamic ESM import)
// Verifies access tokens against the project's JWKS and can fetch the user JSON.

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const http = require('http');
const https = require('https');
let _jose = null;
let _jwks = null;
const TABLE_PROFILES = (process.env.TABLE_PROFILES || 'profiles').trim().toLowerCase();

async function getJose() {
  if (_jose) return _jose;
  // jose is ESM-only; use dynamic import from CJS
  _jose = await import('jose');
  return _jose;
}

// Tiny JSON GET helper for Node < 18 (no global fetch)
function httpGetJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    try {
      const u = typeof url === 'string' ? new URL(url) : url;
      const lib = u.protocol === 'https:' ? https : http;
      const req = lib.request(u, { method: 'GET', headers }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`http_${res.statusCode}`));
          }
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.end();
    } catch (e) { reject(e); }
  });
}

// Fetch JWKS using headers (some projects reject apikey as query param)
async function getJWKS() {
  if (_jwks) return _jwks;
  const { createLocalJWKSet } = await getJose();
  if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
  const candidates = [
    '/auth/v1/keys',
    // Some deployments expose OIDC JWKS here:
    '/auth/v1/oidc/.well-known/jwks.json',
    '/.well-known/jwks.json',
  ];
  const headers = SERVICE_KEY ? { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } : {};
  let lastErr = null;
  for (const p of candidates) {
    const url = new URL(p, SUPABASE_URL);
    try {
      try { console.log('[DEBUG][auth] fetching JWKS from', url.toString()); } catch (_) {}
      let jwks;
      if (typeof fetch === 'function') {
        const r = await fetch(url, { headers });
        try { console.log('[DEBUG][auth] JWKS response status', r.status, 'for', p); } catch (_) {}
        if (!r.ok) throw new Error(`jwks_http_${r.status}`);
        jwks = await r.json();
      } else {
        jwks = await httpGetJson(url, headers);
        try { console.log('[DEBUG][auth] JWKS fetched via http(S) fallback for', p); } catch (_) {}
      }
      _jwks = createLocalJWKSet(jwks);
      return _jwks;
    } catch (e) {
      lastErr = e;
      try { console.warn('[DEBUG][auth] JWKS fetch failed for', p, e?.message || e); } catch (_) {}
      // try next candidate
    }
  }
  throw lastErr || new Error('jwks_unavailable');
}

async function verifySupabaseAccessToken(token) {
  if (!token || typeof token !== 'string') throw new Error('No token');
  const { jwtVerify } = await getJose();
  let jwks;
  try {
    jwks = await getJWKS();
  } catch (e) {
    // If JWKS cannot be fetched at all, attempt direct user lookup fallback
    try { console.warn('[DEBUG][auth] getJWKS failed, trying fallback user lookup', e?.message || e); } catch (_) {}
    try {
      const userJson = await fetchSupabaseUser(token);
      const uid = userJson?.id || userJson?.user?.id || null;
      const email = userJson?.email || userJson?.user?.email || null;
      if (uid) {
        try { console.log('[DEBUG][auth] verify fallback ok userId', uid); } catch (_) {}
        return { userId: uid, email, role: null, payload: { sub: uid, email } };
      }
    } catch (e2) {
      try { console.warn('[DEBUG][auth] fallback user lookup failed', e2?.message || e2); } catch (_) {}
    }
    throw e; // preserve original error
  }
  try {
    try { console.log('[DEBUG][auth] verifying token', String(token).slice(0, 16) + '…'); } catch (_) {}
    const { payload } = await jwtVerify(token, jwks, {
      // No audience/issuer enforcement to support default Supabase tokens
    });
    const userId = payload.sub || payload.user_id || null;
    const email = payload.email || null;
    const role = payload.role || null;
    try { console.log('[DEBUG][auth] verify ok userId', userId); } catch (_) {}
    return { userId, email, role, payload };
  } catch (e) {
    try {
      // Decode token payload iss for diagnostics (no verification)
      const parts = String(token).split('.');
      if (parts.length >= 2) {
        const payloadStr = Buffer.from(parts[1], 'base64').toString('utf8');
        const iss = (() => { try { return JSON.parse(payloadStr)?.iss; } catch { return undefined; } })();
        console.warn('[DEBUG][auth] verify failed (JWKS path)', e?.message || e, 'token.iss=', iss, 'expected host=', SUPABASE_URL);
      } else {
        console.warn('[DEBUG][auth] verify failed (JWKS path)', e?.message || e);
      }
    } catch (_) {}
    // Fallback: call Supabase /auth/v1/user with the provided token. If it returns,
    // the token is valid; derive fields from response. This covers projects using
    // symmetric signing or edge cases where JWKS verifying is blocked.
    try {
      const userJson = await fetchSupabaseUser(token);
      const uid = userJson?.id || userJson?.user?.id || null;
      const email = userJson?.email || userJson?.user?.email || null;
      if (uid) {
        try { console.log('[DEBUG][auth] verify fallback ok userId', uid); } catch (_) {}
        return { userId: uid, email, role: null, payload: { sub: uid, email } };
      }
    } catch (e2) {
      try { console.warn('[DEBUG][auth] fallback user lookup failed', e2?.message || e2); } catch (_) {}
    }
    throw e;
  }
}

// Fetch the Supabase user JSON using a user access token. Useful to check verification.
async function fetchSupabaseUser(token) {
  if (!token || typeof token !== 'string') throw new Error('No token');
  if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
  const url = new URL('/auth/v1/user', SUPABASE_URL);
  const keyForApi = ANON_KEY || SERVICE_KEY || '';
  try { console.log('[DEBUG][auth] fallback /auth/v1/user using', ANON_KEY ? 'anon_key' : (SERVICE_KEY ? 'service_key' : 'no_key')); } catch (_) {}
  const headers = {
    Authorization: `Bearer ${token}`,
    apikey: keyForApi,
  };
  if (typeof fetch === 'function') {
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`user_http_${r.status}`);
    const j = await r.json();
    return j || null;
  } else {
    return await httpGetJson(url, headers);
  }
}

// Fetch a user's display_name from the public profiles table via PostgREST
async function fetchProfileDisplayName(userId) {
  if (!userId) throw new Error('No userId');
  if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
  if (!SERVICE_KEY) throw new Error('Missing SERVICE_KEY');
  if (typeof fetch !== 'function') throw new Error('fetch_unavailable');
  const url = new URL(`/rest/v1/${TABLE_PROFILES}`, SUPABASE_URL);
  url.searchParams.set('id', `eq.${userId}`);
  url.searchParams.set('select', 'display_name');
  url.searchParams.set('limit', '1');
  const r = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!r.ok) throw new Error(`profiles_http_${r.status}`);
  const arr = await r.json();
  const name = Array.isArray(arr) && arr[0] && arr[0].display_name ? String(arr[0].display_name) : '';
  return name || null;
}

module.exports = { verifySupabaseAccessToken, fetchSupabaseUser, fetchProfileDisplayName };

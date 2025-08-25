// Supabase JWT verification helper (CommonJS with dynamic ESM import)
// Verifies access tokens against the project's JWKS and can fetch the user JSON.

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
let _jose = null;
let _jwks = null;

async function getJose() {
  if (_jose) return _jose;
  // jose is ESM-only; use dynamic import from CJS
  _jose = await import('jose');
  return _jose;
}

async function getJWKS() {
  if (_jwks) return _jwks;
  const { createRemoteJWKSet } = await getJose();
  if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
  const url = new URL('/auth/v1/keys', SUPABASE_URL);
  _jwks = createRemoteJWKSet(url);
  return _jwks;
}

async function verifySupabaseAccessToken(token) {
  if (!token || typeof token !== 'string') throw new Error('No token');
  const { jwtVerify } = await getJose();
  const jwks = await getJWKS();
  const { payload } = await jwtVerify(token, jwks, {
    // No audience/issuer enforcement to support default Supabase tokens
  });
  // Standard fields: sub (user id), email (if provided), role, exp
  const userId = payload.sub || payload.user_id || null;
  const email = payload.email || null;
  const role = payload.role || null;
  return { userId, email, role, payload };
}

// Fetch the Supabase user JSON using a user access token. Useful to check verification.
async function fetchSupabaseUser(token) {
  if (!token || typeof token !== 'string') throw new Error('No token');
  if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL');
  if (typeof fetch !== 'function') throw new Error('fetch_unavailable');
  const url = new URL('/auth/v1/user', SUPABASE_URL);
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      // apikey is required by Supabase; service key works on server
      apikey: SERVICE_KEY || '',
    },
  });
  if (!r.ok) throw new Error(`user_http_${r.status}`);
  const j = await r.json();
  return j || null;
}

module.exports = { verifySupabaseAccessToken, fetchSupabaseUser };

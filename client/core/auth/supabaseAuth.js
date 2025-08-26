// Supabase Auth wrapper (client-side, Vite)
// Exposes init, sign-in methods, session access, and profile creation helper.

import { createClient } from '@supabase/supabase-js';

let supabase = null;
let inited = false;

export function initSupabase() {
  if (inited && supabase) return supabase;
  // Prefer Vite env, then window, then localStorage, then prompt (dev-only) to avoid committing secrets
  let url = import.meta?.env?.VITE_SUPABASE_URL || window.VITE_SUPABASE_URL || localStorage.getItem('VITE_SUPABASE_URL') || '';
  let anon = import.meta?.env?.VITE_SUPABASE_ANON_KEY || window.VITE_SUPABASE_ANON_KEY || localStorage.getItem('VITE_SUPABASE_ANON_KEY') || '';
  // If still missing, prompt once and persist to localStorage (public anon key is safe in client)
  if (!url || !anon) {
    try {
      if (!url) {
        const u = prompt('Enter Supabase URL (https://<project>.supabase.co)');
        if (u) { url = u.trim(); localStorage.setItem('VITE_SUPABASE_URL', url); }
      }
      if (!anon) {
        const a = prompt('Enter Supabase ANON key (public)');
        if (a) { anon = a.trim(); localStorage.setItem('VITE_SUPABASE_ANON_KEY', anon); }
      }
    } catch (_) {}
  }
  // Debug: print env-derived values to help diagnose configuration
  try {
    console.log('[auth] VITE_SUPABASE_URL =', url);
    console.log('[auth] VITE_SUPABASE_ANON_KEY =', anon);
  } catch (_) {}
  if (!url || !anon) {
    console.warn('[auth] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
  }
  supabase = createClient(url, anon, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.sessionStorage,
    },
    global: { headers: { 'x-application-name': 'mp.test-client' } },
  });
  inited = true;
  return supabase;
}

export function getClient() {
  return supabase || initSupabase();
}

export async function getSession() {
  const { data } = await getClient().auth.getSession();
  return data?.session || null;
}

export async function getUser() {
  const { data } = await getClient().auth.getUser();
  return data?.user || null;
}

export async function getAccessToken() {
  const s = await getSession();
  return s?.access_token || null;
}

export function onAuthStateCknge(cb) {
  return getClient().auth.onAuthStateChange((event, session) => {
    try { cb && cb({ event, session }); } catch (_) {}
  });
}

export async function signInWithProvider(provider) {
  // provider: 'google' | 'discord'
  const redirectTo = window.location.origin;
  const { data, error } = await getClient().auth.signInWithOAuth({ provider, options: { redirectTo } });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(email, password) {
  const redirectTo = window.location.origin;
  const { data, error } = await getClient().auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
  if (error) throw error;
  return data;
}

export async function signInWithPassword(email, password) {
  const { data, error } = await getClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function sendPasswordReset(email) {
  const redirectTo = window.location.origin;
  const { data, error } = await getClient().auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
  return data;
}

export async function updatePassword(newPassword) {
  const { data, error } = await getClient().auth.updateUser({ password: newPassword });
  if (error) throw error;
  return data;
}

export async function linkProvider(provider) {
  const { data, error } = await getClient().auth.linkIdentity({ provider });
  if (error) throw error;
  return data;
}

// Ensure a profile row exists for the current user; create dummy if missing.
export async function ensureProfileForCurrentUser() {
  try {
    const user = await getUser();
    if (!user) return null;
    const uid = user.id;
    const existing = await getClient().from('profiles').select('id, display_name').eq('id', uid).maybeSingle();
    if (existing?.data) return existing.data;
    const dummy = {
      id: uid,
      display_name: buildDummyName(user),
      user_since: new Date().toISOString(),
      games_played: 0,
      hours_played: 0,
      contributed_cents: 0,
    };
    const up = await getClient().from('profiles').upsert(dummy).select().single();
    return up?.data || null;
  } catch (e) {
    console.warn('[auth] ensureProfile failed (table or policy missing?)', e);
    return null;
  }
}

function buildDummyName(user) {
  const base = (user?.email?.split('@')[0] || 'Hero').replace(/[^a-zA-Z0-9_\-]/g, '');
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || 'Hero'}${suffix}`;
}

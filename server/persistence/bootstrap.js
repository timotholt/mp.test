// Schema bootstrapper (CommonJS)
// Creates required tables/policies idempotently on server boot.
// Requires: SUPABASE_DB_URL (postgres connection string)
// Optional: RUN_DB_BOOTSTRAP=true to enable
// Uses only standard SQL and pg; safe to run repeatedly.

const ENABLE = String(process.env.RUN_DB_BOOTSTRAP || '').toLowerCase() === 'true';
const DB_URL = process.env.SUPABASE_DB_URL || '';

function sanitizeIdent(name, fallback) {
  const v = String(name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  return v || fallback;
}

async function runBootstrap() {
  if (!ENABLE) {
    console.log('[bootstrap] disabled (set RUN_DB_BOOTSTRAP=true to enable)');
    return;
  }
  if (!DB_URL) {
    console.warn('[bootstrap] missing SUPABASE_DB_URL; skipping');
    return;
  }
  let Client;
  try {
    // Lazy require so local dev without pg still works
    ({ Client } = require('pg'));
  } catch (_) {
    console.warn('[bootstrap] pg module not installed; skipping');
    return;
  }

  const TABLE_GAMESTATE = sanitizeIdent(process.env.TABLE_GAMESTATE, 'gamestate');
  const TABLE_PROFILES = sanitizeIdent(process.env.TABLE_PROFILES, 'profiles');

  const client = new Client({ connectionString: DB_URL, application_name: 'mp.test-bootstrap' });
  await client.connect();

  try {
    // Note: Policies use DO blocks to be idempotent across restarts.
    const sql = `
    -- Profiles table (RLS-enabled; auth.users foreign key)
    create table if not exists public.${TABLE_PROFILES} (
      id uuid primary key references auth.users(id) on delete cascade,
      display_name text,
      user_since timestamptz default now(),
      games_played int default 0,
      hours_played int default 0,
      contributed_cents int default 0
    );

    alter table public.${TABLE_PROFILES} enable row level security;

    do $$ begin
      if not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = '${TABLE_PROFILES}' and p.policyname = 'profiles_select_own'
      ) then
        execute 'create policy "profiles_select_own" on public.${TABLE_PROFILES}
          for select to authenticated
          using ( auth.uid() = id )';
      end if;
    end $$;

    do $$ begin
      if not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = '${TABLE_PROFILES}' and p.policyname = 'profiles_insert_own'
      ) then
        execute 'create policy "profiles_insert_own" on public.${TABLE_PROFILES}
          for insert to authenticated
          with check ( auth.uid() = id )';
      end if;
    end $$;

    do $$ begin
      if not exists (
        select 1 from pg_policies p
        where p.schemaname = 'public' and p.tablename = '${TABLE_PROFILES}' and p.policyname = 'profiles_update_own'
      ) then
        execute 'create policy "profiles_update_own" on public.${TABLE_PROFILES}
          for update to authenticated
          using ( auth.uid() = id )
          with check ( auth.uid() = id )';
      end if;
    end $$;

    -- Game state snapshots (server-only; no RLS needed)
    create table if not exists public.${TABLE_GAMESTATE} (
      id bigserial primary key,
      game_id text not null,
      data jsonb,
      created_at timestamptz default now()
    );

    create index if not exists ${TABLE_GAMESTATE}_game_time on public.${TABLE_GAMESTATE} (game_id, created_at);
    `;

    await client.query(sql);
    console.log('[bootstrap] schema ensured');
  } catch (e) {
    console.warn('[bootstrap] failed', e);
  } finally {
    try { await client.end(); } catch (_) {}
  }
}

module.exports = { runBootstrap };

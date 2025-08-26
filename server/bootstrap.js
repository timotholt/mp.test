// Comprehensive bootstrap and diagnostics (CommonJS)
// Run on server boot or manually: `node server/bootstrap.js`
// Checks env, dependencies, DB connectivity, tables, policies, and REST exposure.
// Prints clear PASS/FAIL for each step and a final summary.

const path = require('path');
const dns = require('dns').promises;
try { require('dotenv').config({ path: path.resolve(__dirname, '.env') }); } catch (_) {}

const START_TS = new Date().toISOString();
const HEADER = `[bootstrap]`;

function logStep(title) { console.log(`${HEADER} ${title}`); }
function logPass(msg) { console.log(`${HEADER} PASS: ${msg}`); }
function logFail(msg) { console.log(`${HEADER} FAIL: ${msg}`); }
function logInfo(msg) { console.log(`${HEADER} ${msg}`); }

function cmpSemver(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if (pa[i] !== pb[i]) return pa[i] - pb[i]; }
  return 0;
}

async function runFullBootstrap() {
  logInfo(`starting at ${START_TS}`);

  // 1) Node version
  logStep('Checking Node version (>= 18.0.0 for global fetch)');
  try {
    const v = process.version;
    if (cmpSemver(v, '18.0.0') >= 0) logPass(`Node ${v}`); else logFail(`Node ${v} < 18.0.0`);
  } catch (e) { logFail(`Cannot read Node version: ${e && e.message}`); }

  // 2) Environment variables
  const SUPABASE_URL = process.env.SUPABASE_URL || '';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
  const DB_URL = process.env.SUPABASE_DB_URL || '';
  const RUN_FLAG = String(process.env.RUN_DB_BOOTSTRAP || '').toLowerCase() === 'true';
  logStep('Checking required env vars');
  SUPABASE_URL ? logPass('SUPABASE_URL set') : logFail('SUPABASE_URL missing');
  SERVICE_KEY ? logPass('SUPABASE_SERVICE_KEY set') : logFail('SUPABASE_SERVICE_KEY missing');
  RUN_FLAG ? logPass('RUN_DB_BOOTSTRAP=true') : logInfo('RUN_DB_BOOTSTRAP not true — will report only, skip DDL');
  DB_URL ? logPass('SUPABASE_DB_URL set') : logInfo('SUPABASE_DB_URL missing — cannot connect for DDL');

  // 3) Dependency: pg
  logStep('Checking dependency: pg');
  let pg = null;
  try {
    pg = require('pg');
    if (typeof pg.Client === 'function') logPass('pg loaded'); else logFail('pg.Client not found');
  } catch (e) {
    logFail('pg not installed — run `npm install`');
  }

  // 4) Connect to Postgres
  let client = null;
  if (pg && DB_URL) {
    logStep('Connecting to Postgres (SUPABASE_DB_URL)');
    try {
      // First try: direct connection string with SSL enabled
      const primaryCfg = { connectionString: DB_URL, application_name: 'mp.test-bootstrap', ssl: { rejectUnauthorized: false } };
      client = new pg.Client(primaryCfg);
      await client.connect();
      await client.query('select 1');
      logPass('Connected to Postgres');
    } catch (e) {
      logFail(`Postgres connection failed: ${e && e.message}`);
      // IPv4 fallback: some networks return only AAAA, or block IPv6
      try {
        const u = new URL(DB_URL);
        const host = u.hostname;
        const a4 = await dns.lookup(host, { family: 4 });
        const cfg = {
          host: a4.address,
          user: decodeURIComponent(u.username || ''),
          password: decodeURIComponent(u.password || ''),
          port: Number(u.port) || 5432,
          database: (u.pathname || '/postgres').replace(/^\//, '') || 'postgres',
          application_name: 'mp.test-bootstrap',
          ssl: { rejectUnauthorized: false },
        };
        logInfo(`IPv4 fallback via ${a4.address}`);
        client = new pg.Client(cfg);
        await client.connect();
        await client.query('select 1');
        logPass('Connected to Postgres (IPv4 fallback)');
      } catch (e2) {
        logFail(`IPv4 fallback failed: ${e2 && e2.message}`);
        // IPv6 fallback using AAAA if host has no A record but AAAA exists
        try {
          const u = new URL(DB_URL);
          const host = u.hostname;
          const a6 = await dns.lookup(host, { family: 6 });
          const cfg6 = {
            host: a6.address,
            user: decodeURIComponent(u.username || ''),
            password: decodeURIComponent(u.password || ''),
            port: Number(u.port) || 5432,
            database: (u.pathname || '/postgres').replace(/^\//, '') || 'postgres',
            application_name: 'mp.test-bootstrap',
            ssl: { rejectUnauthorized: false },
          };
          logInfo(`IPv6 fallback via ${a6.address}`);
          client = new pg.Client(cfg6);
          await client.connect();
          await client.query('select 1');
          logPass('Connected to Postgres (IPv6 fallback)');
        } catch (e3) {
          logFail(`IPv6 fallback failed: ${e3 && e3.message}`);
          client = null;
        }
      }
    }
  }

  // Helper to run SQL with label
  async function runSQL(label, sql) {
    if (!client) { logInfo(`${label}: skipped (no DB client)`); return false; }
    try {
      await client.query(sql);
      logPass(label);
      return true;
    } catch (e) {
      logFail(`${label}: ${e && e.message}`);
      return false;
    }
  }

  // 5) Ensure tables/policies
  const TABLE_PROFILES = (process.env.TABLE_PROFILES || 'profiles').trim().toLowerCase();
  const TABLE_GAMESTATE = (process.env.TABLE_GAMESTATE || 'gamestate').trim().toLowerCase();

  if (RUN_FLAG && client) {
    logStep(`Ensuring table public.${TABLE_PROFILES}`);
    await runSQL(`create table if not exists public.${TABLE_PROFILES}`,
      `create table if not exists public.${TABLE_PROFILES} (
        id uuid primary key references auth.users(id) on delete cascade,
        display_name text,
        user_since timestamptz default now(),
        games_played int default 0,
        hours_played int default 0,
        contributed_cents int default 0
      );`);

    await runSQL(`enable RLS on public.${TABLE_PROFILES}`,
      `alter table public.${TABLE_PROFILES} enable row level security;`);

    await runSQL(`policy profiles_select_own`,
      `do $$ begin
         if not exists (
           select 1 from pg_policies p
           where p.schemaname='public' and p.tablename='${TABLE_PROFILES}' and p.policyname='profiles_select_own'
         ) then
           execute 'create policy "profiles_select_own" on public.${TABLE_PROFILES}
             for select to authenticated using (auth.uid() = id)';
         end if;
       end $$ language plpgsql;`);

    await runSQL(`policy profiles_insert_own`,
      `do $$ begin
         if not exists (
           select 1 from pg_policies p
           where p.schemaname='public' and p.tablename='${TABLE_PROFILES}' and p.policyname='profiles_insert_own'
         ) then
           execute 'create policy "profiles_insert_own" on public.${TABLE_PROFILES}
             for insert to authenticated with check (auth.uid() = id)';
         end if;
       end $$ language plpgsql;`);

    await runSQL(`policy profiles_update_own`,
      `do $$ begin
         if not exists (
           select 1 from pg_policies p
           where p.schemaname='public' and p.tablename='${TABLE_PROFILES}' and p.policyname='profiles_update_own'
         ) then
           execute 'create policy "profiles_update_own" on public.${TABLE_PROFILES}
             for update to authenticated using (auth.uid() = id) with check (auth.uid() = id)';
         end if;
       end $$ language plpgsql;`);

    logStep(`Ensuring table public.${TABLE_GAMESTATE}`);
    await runSQL(`create table if not exists public.${TABLE_GAMESTATE}`,
      `create table if not exists public.${TABLE_GAMESTATE} (
        id bigserial primary key,
        game_id text not null,
        data jsonb,
        created_at timestamptz default now()
      );`);
    await runSQL(`create index if not exists ${TABLE_GAMESTATE}_game_time`,
      `create index if not exists ${TABLE_GAMESTATE}_game_time on public.${TABLE_GAMESTATE} (game_id, created_at);`);
  } else {
    logInfo('DDL skipped (either RUN_DB_BOOTSTRAP not true or no DB connection)');
  }

  // 6) Verify results via SQL
  if (client) {
    logStep('Verifying schema via SQL');
    try {
      const r1 = await client.query(`select to_regclass('public.${TABLE_PROFILES}') as reg;`);
      const r2 = await client.query(`select to_regclass('public.${TABLE_GAMESTATE}') as reg;`);
      (r1.rows[0]?.reg) ? logPass(`public.${TABLE_PROFILES} present`) : logFail(`public.${TABLE_PROFILES} missing`);
      (r2.rows[0]?.reg) ? logPass(`public.${TABLE_GAMESTATE} present`) : logFail(`public.${TABLE_GAMESTATE} missing`);
    } catch (e) {
      logFail(`verification query failed: ${e && e.message}`);
    }

    try {
      const rp = await client.query(
        `select policyname, cmd from pg_policies where schemaname='public' and tablename='${TABLE_PROFILES}' order by policyname;`
      );
      const names = new Set((rp.rows || []).map(r => r.policyname));
      ['profiles_select_own','profiles_insert_own','profiles_update_own'].forEach(p => {
        names.has(p) ? logPass(`policy ${p} present`) : logFail(`policy ${p} missing`);
      });
    } catch (e) {
      logFail(`policy check failed: ${e && e.message}`);
    }
  }

  // 7) Verify REST exposure via PostgREST
  if (SUPABASE_URL && SERVICE_KEY) {
    logStep('Verifying REST access to /rest/v1/profiles');
    try {
      const url = new URL('/rest/v1/profiles', SUPABASE_URL);
      url.searchParams.set('select', 'id');
      url.searchParams.set('limit', '1');
      const r = await fetch(url, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
      });
      if (r.ok) logPass(`REST responded ${r.status}`);
      else logFail(`REST responded ${r.status}`);
    } catch (e) {
      logFail(`REST check failed: ${e && e.message}`);
    }
  } else {
    logInfo('REST check skipped (missing SUPABASE_URL or SERVICE_KEY)');
  }

  // Close DB
  if (client) { try { await client.end(); logInfo('DB connection closed'); } catch (_) {} }

  logInfo('bootstrap finished');
}

module.exports = { runFullBootstrap };

// Allow running standalone: `node server/bootstrap.js`
if (require.main === module) {
  runFullBootstrap().catch(e => { logFail(`fatal: ${e && e.message}`); process.exitCode = 1; });
}

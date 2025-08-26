// Simple interactive boot prompt with timeout (CommonJS)
// Exports:
//  - promptForKeyWithTimeout(ms)
//  - runSafemodeMenu() -> performs destructive maintenance actions on demand
// Deletion actions use direct Postgres access via SUPABASE_DB_URL.

function promptForKeyWithTimeout(timeoutMs = 5000) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (!stdin || !stdin.isTTY) {
      // No TTY available. Optional fallback: allow line-based input if FORCE_SAFEMODE_ON_BOOT is set.
      const force = String(process.env.FORCE_SAFEMODE_ON_BOOT || '').toLowerCase();
      if (force === '1' || force === 'true' || force === 'yes') {
        try {
          const rl = require('readline').createInterface({ input: stdin, output: process.stdout });
          const timer = setTimeout(() => { try { rl.close(); } catch (_) {}; resolve(null); }, timeoutMs);
          rl.question("Type 'S' then Enter to enter safemode (or wait to continue): ", (answer) => {
            try { clearTimeout(timer); } catch (_) {}
            try { rl.close(); } catch (_) {}
            const key = (answer && answer.length) ? answer[0] : null;
            resolve(key);
          });
        } catch (_) {
          return resolve(null);
        }
      } else {
        // No TTY and not forced -> skip prompt
        return resolve(null);
      }
      return; // prevent continuing into raw-mode path
    }

    const onData = (data) => {
      try { clearTimeout(timer); } catch (_) {}
      cleanup();
      const str = data.toString('utf8');
      // Handle Ctrl+C
      if (str === '\u0003') { process.stdout.write('\n'); process.exit(130); }
      // Single char key (take first byte)
      const key = str && str.length > 0 ? str[0] : null;
      resolve(key);
    };

    const cleanup = () => {
      try { stdin.removeListener('data', onData); } catch (_) {}
      try { stdin.setRawMode && stdin.setRawMode(false); } catch (_) {}
      try { stdin.pause(); } catch (_) {}
    };

    let timer;
    try {
      stdin.setEncoding('utf8');
      stdin.setRawMode && stdin.setRawMode(true);
      stdin.resume();
      stdin.on('data', onData);
      timer = setTimeout(() => { cleanup(); resolve(null); }, timeoutMs);
    } catch (_) {
      // If raw mode fails, just resolve immediately
      try { cleanup(); } catch (__) {}
      resolve(null);
    }
  });
}

// Safemode destructive actions (DB-level). Minimal and explicit.
async function _connectDb() {
  const DB_URL = process.env.SUPABASE_DB_URL || '';
  if (!DB_URL) { console.log('[safemode] SUPABASE_DB_URL missing'); return null; }
  let Client;
  try { ({ Client } = require('pg')); } catch (_) { console.log('[safemode] pg not installed'); return null; }
  try {
    const client = new Client({ connectionString: DB_URL, application_name: 'mp.test-safemode', ssl: { rejectUnauthorized: false } });
    await client.connect();
    return client;
  } catch (e) {
    console.log('[safemode] DB connect failed:', e && e.message);
    return null;
  }
}

async function _truncateIfExists(client, fqtn) {
  try {
    await client.query(`do $$ begin if to_regclass('${fqtn}') is not null then execute 'truncate ${fqtn} cascade'; end if; end $$;`);
    console.log(`[safemode] truncated ${fqtn} (if existed)`);
  } catch (e) {
    console.log(`[safemode] truncate ${fqtn} failed:`, e && e.message);
  }
}

async function deleteSavefiles(client) {
  const table = (process.env.TABLE_GAMESTATE || 'gamestate').trim().toLowerCase();
  await _truncateIfExists(client, `public.${table}`);
}

async function deleteUserAccounts(client) {
  // Will cascade to profiles because profiles.id references auth.users(id) on delete cascade
  await _truncateIfExists(client, 'auth.users');
}

async function deleteChatMessages(client) {
  // Best-guess table; no-op if absent
  await _truncateIfExists(client, 'public.chat_messages');
}

async function deleteAll(client) {
  await deleteSavefiles(client);
  await deleteUserAccounts(client);
  await deleteChatMessages(client);
}

async function runSafemodeMenu() {
  console.log('');
  console.log('Safemode menu:');
  console.log('V = (V)erify Supabase settings and schema');
  console.log('I = (I)nit Supabase schema (then verify)');
  console.log('S = delete all (S)avefiles');
  console.log('U = delete all (U)ser Accounts');
  console.log('C = delete all (C)hat Messages');
  console.log('A = delete (A)ll (Savefiles, User Accounts, Chat Messages)');
  console.log('Waiting 30s for selection...');

  const key = await promptForKeyWithTimeout(30000);
  if (!key) { console.log('[safemode] no selection; continuing'); return; }
  const k = String(key).toUpperCase();
  let client = null;
  try {
    if (k === 'V' || k === 'I') {
      // Temporarily override RUN_DB_BOOTSTRAP for this run
      const prev = process.env.RUN_DB_BOOTSTRAP;
      try {
        process.env.RUN_DB_BOOTSTRAP = (k === 'I') ? 'true' : 'false';
        const { runFullBootstrap } = require('../bootstrap');
        await runFullBootstrap();
      } catch (e) {
        console.log('[safemode] bootstrap run failed:', (e && e.message) || e);
      } finally {
        if (prev === undefined) delete process.env.RUN_DB_BOOTSTRAP; else process.env.RUN_DB_BOOTSTRAP = prev;
      }
    } else if (k === 'S' || k === 'U' || k === 'C' || k === 'A') {
      client = await _connectDb();
      if (!client) { console.log('[safemode] no DB connection; aborting'); return; }
      if (k === 'S') { await deleteSavefiles(client); }
      else if (k === 'U') { await deleteUserAccounts(client); }
      else if (k === 'C') { await deleteChatMessages(client); }
      else if (k === 'A') { await deleteAll(client); }
    }
    else { console.log(`[safemode] unknown option '${k}'`); }
  } finally {
    try { if (client) await client.end(); } catch (_) {}
  }
}

module.exports = { promptForKeyWithTimeout, runSafemodeMenu };

// High-level entry point to be called from server/index.js
// - If BOOT_PROMPT_MS is undefined -> default 5000ms
// - If set and numeric -> use that; 0/invalid disables prompt
// - On 'S' -> run safemode menu
// - Afterward -> kick off runFullBootstrap() (fire-and-forget)
async function safeMode() {
  const envVal = process.env.BOOT_PROMPT_MS;
  const hasVal = (envVal !== undefined) && (String(envVal).trim() !== '');
  const timeoutMs = hasVal ? (parseInt(envVal, 10) || 0) : 5000;
  const force = String(process.env.FORCE_SAFEMODE_ON_BOOT || '').toLowerCase();
  const allowFallback = (force === '1' || force === 'true' || force === 'yes');
  const hasTTY = !!(process.stdin && process.stdin.isTTY);
  const showPrompt = timeoutMs > 0 && (hasTTY || allowFallback);

  // Always print the safemode hint if a prompt timeout is configured
  if (timeoutMs > 0) {
    const secs = Math.max(1, Math.round(timeoutMs / 1000));
    const tip = (!hasTTY && !allowFallback)
      ? " Tip: set FORCE_SAFEMODE_ON_BOOT=1 in server/.env or run 'npm run server' in a terminal to interact."
      : '';
    console.log(`[boot] Server starting in ${secs} seconds. Press 'S' to enter safemode menu.${tip}`);
  }

  let enteredSafemode = false;
  if (showPrompt) {
    try {
      const key = await promptForKeyWithTimeout(timeoutMs);
      if (key && String(key).toLowerCase() === 's') {
        console.log('[boot] Entering safemode...');
        enteredSafemode = true;
        await runSafemodeMenu();
      } else if (key) {
        console.log(`[boot] Key '${String(key)}' pressed; ignoring (only 'S' enters safemode)`);
      } else {
        console.log('[boot] No key pressed; continuing normal boot');
      }
    } catch (e) {
      console.warn('[boot] prompt error', (e && e.message) || e);
    }
  } else if (timeoutMs > 0) {
    // No interactive input available; still respect the countdown delay
    await new Promise(resolve => setTimeout(resolve, timeoutMs));
  }

  // No auto-bootstrap here; bootstrap should only run via safemode menu (I/V)
}

module.exports.safeMode = safeMode;

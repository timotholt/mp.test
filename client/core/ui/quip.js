// Centralized quip utility
// Usage:
//   import { getQuip, clearQuip } from '../core/ui/quip.js'
//   const line = getQuip('login.tagline', ["One", "Two", "Three"])
//
// Behavior:
// - Returns a quip for a given key from the provided pool.
// - The quip updates at most once per ROTATE_MS window (default 2000ms) per key.
// - When rotating, we avoid returning the same quip index as the previous one if possible.
// - Clearing a key (clearQuip) forces an immediate refresh on next call.

const _cache = new Map();
const ROTATE_MS = 1000; // rotate quip every 2 seconds per key

/**
 * Returns a rotating quip for a given key.
 * - Within a 2s window, repeated calls return the same value for that key (cache hit).
 * - When the 2s window advances, picks a new random quip, avoiding the last index if possible.
 *
 * @param {string} key Unique identifier for where this quip is shown (e.g., 'settings.overlay.header')
 * @param {string[]} pool Array of candidate quip strings.
 * @returns {string} The chosen quip (or empty string if pool is empty/invalid).
 */
export function getQuip(key, pool) {
  if (!key || !Array.isArray(pool) || pool.length === 0) return '';
  const slot = Math.floor(Date.now() / ROTATE_MS);
  const prev = _cache.get(key);
  // If we already computed a quip for this slot, reuse it
  if (prev && prev.slot === slot && typeof prev.value === 'string') return prev.value;

  const n = pool.length;
  // Determine last index if it exists and is valid
  const lastIndex = prev && Number.isInteger(prev.index) && prev.index >= 0 && prev.index < n ? prev.index : -1;

  let idx = 0;
  if (n <= 1) {
    idx = 0; // only option
  } else {
    // pick a random index in [0, n-2]; then skip over lastIndex
    const r = Math.floor(Math.random() * (n - 1));
    idx = (lastIndex >= 0 && r >= lastIndex) ? r + 1 : r;
    if (idx >= n) idx = n - 1; // guard in case lastIndex == n-1
  }

  const value = pool[idx] ?? '';
  _cache.set(key, { slot, index: idx, value });
  return value;
}

/**
 * Clears a single cached quip by key, or clears all when no key provided.
 * @param {string} [key]
 */
export function clearQuip(key) {
  if (typeof key === 'string' && key.length > 0) {
    _cache.delete(key); // force refresh on next getQuip(key, ...)
  } else {
    _cache.clear();
  }
}

// Utility: derive a stable gameId from room name and host (URL override supported)
export function deriveGameId(name, hostName) {
  try {
    const params = new URLSearchParams(location.search || '');
    const hashMatch = (location.hash || '').match(/gameId=([A-Za-z0-9_-]+)/);
    const forced = params.get('gameId') || (hashMatch ? hashMatch[1] : '');
    if (forced) return String(forced).slice(0, 48);
  } catch (_) {}
  const base = String(name || 'game')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'game';
  const host = String(hostName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 8);
  return [base, host].filter(Boolean).join('-');
}

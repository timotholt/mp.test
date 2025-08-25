// wireRoomEvents extracted from main.js
// Wires server messages to UI and state handlers. Pure function with explicit deps.

export function wireRoomEvents(r, deps) {
  const {
    log,
    setRoute,
    APP_STATES,
    presentSubstate,
    OverlayManager,
    PRIORITY,
    presentStartGameConfirm,
    getPlayersSnapshot,
    appendChatLine,
    setReadyButtonUI,
    presentFCLSelectModal,
    onLeave,
  } = deps || {};

  let lastStateVersion = 0;

  // Players
  try {
    r.state.players.onAdd((player, key) => {
      const lx = player.currentLocation?.x; const ly = player.currentLocation?.y; const ll = player.currentLocation?.level ?? 0;
      try { log && log(`+ ${player.name} (${key}) @ ${lx}/${ly}/${ll}`); } catch (_) {}
    });
    r.state.players.onRemove((_, key) => { try { log && log(`- player ${key}`); } catch (_) {} });
  } catch (_) {}

  // Server log
  try { r.state.log.onAdd((value) => { try { log && log(value); } catch (_) {} }); } catch (_) {}

  // Maps & colors
  r.onMessage('dungeonMap', (mapString) => {
    if (window.radianceCascades && typeof window.radianceCascades.setDungeonMap === 'function') {
      window.radianceCascades.setDungeonMap(mapString);
    } else { window.__pendingDungeonMap = mapString; }
  });
  r.onMessage('positionColorMap', (mapString) => {
    if (window.radianceCascades?.surface?.setPositionColorMap) {
      window.radianceCascades.surface.setPositionColorMap(mapString);
    } else { window.__pendingPositionColorMap = mapString; }
  });
  r.onMessage('characterColorMap', (mapString) => {
    if (window.radianceCascades?.surface?.setCharacterColorMap) {
      window.radianceCascades.surface.setCharacterColorMap(mapString);
    } else { window.__pendingCharacterColorMap = mapString; }
  });

  // App state and modal pipeline
  r.onMessage('appState', (msg) => {
    try { console.log('[DEBUG client] appState', msg); } catch (_) {}
    if (typeof msg?.version === 'number' && msg.version < lastStateVersion) return;
    if (typeof msg?.version === 'number') lastStateVersion = msg.version;
    const { state, substate, payload } = msg || {};
    if (state) setRoute && setRoute(state, payload || {});
    if (state === APP_STATES?.GAMEPLAY_ACTIVE) {
      try { OverlayManager && OverlayManager.dismiss && OverlayManager.dismiss('CONFIRM_START'); } catch (_) {}
    }
    if (substate) presentSubstate && presentSubstate(substate, payload || {}); else if (OverlayManager && PRIORITY) OverlayManager.clearBelow(PRIORITY.CRITICAL + 1);
  });
  r.onMessage('modal', (msg) => {
    const { command, id, text, actions, priority, blockInput } = msg || {};
    if (command === 'present') {
      OverlayManager && OverlayManager.present && OverlayManager.present({ id, text, actions, priority: priority ?? (PRIORITY && PRIORITY.MEDIUM), blockInput: blockInput !== false });
    } else if (command === 'dismiss' && id) {
      OverlayManager && OverlayManager.dismiss && OverlayManager.dismiss(id);
    } else if (command === 'clearBelow') {
      OverlayManager && OverlayManager.clearBelow && OverlayManager.clearBelow(priority ?? (PRIORITY && PRIORITY.MEDIUM));
    }
  });

  // Server-driven start game confirmation (host and ready players)
  r.onMessage('showGameConfirm', (payload) => {
    try {
      presentStartGameConfirm && presentStartGameConfirm({
        players: (payload && Array.isArray(payload.players)) ? payload.players : (getPlayersSnapshot ? getPlayersSnapshot() : []),
        canStart: typeof payload?.canStart === 'boolean' ? payload.canStart : undefined,
        isHost: !!(payload && (payload.isHost || (payload.hostId && payload.hostId === r.sessionId))),
        starting: !!payload?.starting,
        countdown: (payload && typeof payload.countdown === 'number') ? payload.countdown : 0,
        youAreReady: !!payload?.youAreReady,
        onStart: () => { try { r.send('startGame'); } catch (_) {} },
        onCancel: () => {
          try { r.send('cancelStart'); } catch (_) {}
          try { setReadyButtonUI && setReadyButtonUI(false); } catch (_) {}
        },
        onUnready: () => {
          try { r.send('setReady', { ready: false }); } catch (_) {}
          try { setReadyButtonUI && setReadyButtonUI(false); } catch (_) {}
          try { appendChatLine && appendChatLine('You are not ready'); } catch (_) {}
        },
        priority: PRIORITY && PRIORITY.MEDIUM,
      });
    } catch (e) { try { console.warn('showGameConfirm handling failed', e); } catch (_) {} }
  });

  // Server-driven Faction/Class/Loadout selection modal (per-player)
  r.onMessage('showFCLSelect', (payload) => {
    try {
      if (!payload?.complete) {
        try { setReadyButtonUI && setReadyButtonUI(false); } catch (_) {}
      }
      presentFCLSelectModal && presentFCLSelectModal({
        factions: payload?.factions || [],
        classes: payload?.classes || [],
        loadouts: payload?.loadouts || [],
        selection: payload?.selection || {},
        complete: !!payload?.complete,
        priority: PRIORITY && PRIORITY.LOW,
        onSelectFaction: (key) => { try { r.send('chooseFaction', { key }); } catch (_) {} },
        onSelectClass: (key) => { try { r.send('chooseClass', { key }); } catch (_) {} },
        onSelectLoadout: (key) => { try { r.send('chooseLoadout', { key }); } catch (_) {} },
        onReady: () => {
          try { r.send('setReady', { ready: true }); } catch (_) {}
          try { setReadyButtonUI && setReadyButtonUI(true); } catch (_) {}
          try { appendChatLine && appendChatLine('You are ready'); } catch (_) {}
        },
      });
    } catch (e) { try { console.warn('showFCLSelect handling failed', e); } catch (_) {} }
  });

  r.onLeave((code) => {
    try { onLeave && onLeave(code); } catch (_) {}
  });
}

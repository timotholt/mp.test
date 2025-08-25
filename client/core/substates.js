// Game substates and modal presentation — extracted from main.js
// Exports: SUBSTATES, priorityForSubstate, defaultActionsFor, presentSubstate

import OverlayManager, { PRIORITY } from './overlayManager.js';

export const SUBSTATES = {
  CURRENT_PLAYER_CHOOSING_CHARACTER_CLASS: 'CURRENT_PLAYER_CHOOSING_CHARACTER_CLASS',
  CURRENT_PLAYER_CHOOSING_CHARACTER_FACTION: 'CURRENT_PLAYER_CHOOSING_CHARACTER_FACTION',
  CURRENT_PLAYER_CHOOSING_CHARACTER_STATS: 'CURRENT_PLAYER_CHOOSING_CHARACTER_STATS',
  CURRENT_PLAYER_CHOOSING_CHARACTER_EQUIPMENT: 'CURRENT_PLAYER_CHOOSING_CHARACTER_EQUIPMENT',
  WAITING_ON_GAME_START: 'WAITING_ON_GAME_START',
  GAME_PAUSED_OTHER_PLAYER_IN_MENU: 'GAME_PAUSED_OTHER_PLAYER_IN_MENU',
  CURRENT_PLAYER_DEAD: 'CURRENT_PLAYER_DEAD',
  OTHER_PLAYER_DEAD: 'OTHER_PLAYER_DEAD',
  CURRENT_PLAYER_DISCONNECTED: 'CURRENT_PLAYER_DISCONNECTED',
  OTHER_PLAYER_DISCONNECTED: 'OTHER_PLAYER_DISCONNECTED',
  CURRENT_PLAYER_REJOINING: 'CURRENT_PLAYER_REJOINING',
  OTHER_PLAYER_REJOINING: 'OTHER_PLAYER_REJOINING',
  CURRENT_PLAYER_KICKED: 'CURRENT_PLAYER_KICKED',
  OTHER_PLAYER_KICKED: 'OTHER_PLAYER_KICKED',
  SERVER_SHUTDOWN: 'SERVER_SHUTDOWN',
  SERVER_REBOOT: 'SERVER_REBOOT',
  CURRENT_PLAYER_QUEST_WINDOW: 'CURRENT_PLAYER_QUEST_WINDOW',
};

export function priorityForSubstate(s) {
  switch (s) {
    case SUBSTATES.SERVER_SHUTDOWN:
    case SUBSTATES.SERVER_REBOOT:
      return PRIORITY.CRITICAL;
    case SUBSTATES.CURRENT_PLAYER_KICKED:
    case SUBSTATES.OTHER_PLAYER_KICKED:
    case SUBSTATES.CURRENT_PLAYER_DEAD:
    case SUBSTATES.OTHER_PLAYER_DEAD:
      return PRIORITY.HIGH;
    case SUBSTATES.GAME_PAUSED_OTHER_PLAYER_IN_MENU:
    case SUBSTATES.CURRENT_PLAYER_DISCONNECTED:
    case SUBSTATES.OTHER_PLAYER_DISCONNECTED:
    case SUBSTATES.CURRENT_PLAYER_REJOINING:
    case SUBSTATES.OTHER_PLAYER_REJOINING:
    case SUBSTATES.WAITING_ON_GAME_START:
      return PRIORITY.MEDIUM;
    case SUBSTATES.CURRENT_PLAYER_CHOOSING_CHARACTER_CLASS:
    case SUBSTATES.CURRENT_PLAYER_CHOOSING_CHARACTER_FACTION:
    case SUBSTATES.CURRENT_PLAYER_CHOOSING_CHARACTER_STATS:
    case SUBSTATES.CURRENT_PLAYER_CHOOSING_CHARACTER_EQUIPMENT:
    case SUBSTATES.CURRENT_PLAYER_QUEST_WINDOW:
    default:
      return PRIORITY.LOW;
  }
}

export function defaultActionsFor(substate) {
  switch (substate) {
    case SUBSTATES.SERVER_SHUTDOWN:
    case SUBSTATES.SERVER_REBOOT:
      return [{ id: 'ok', label: 'OK' }];
    case SUBSTATES.CURRENT_PLAYER_KICKED:
      return [{ id: 'dismiss', label: 'OK' }];
    case SUBSTATES.CURRENT_PLAYER_DEAD:
      return [
        { id: 'respawn', label: 'Respawn' },
        { id: 'spectate', label: 'Spectate' },
      ];
    case SUBSTATES.WAITING_ON_GAME_START:
      return [{ id: 'ready', label: 'Ready' }];
    default:
      return [
        { id: 'yes', label: 'Yes' },
        { id: 'no', label: 'No' },
      ];
  }
}

export function presentSubstate(substate, payload = {}) {
  const prio = priorityForSubstate(substate);
  // Clear any lower-priority modals so higher priority takes precedence
  OverlayManager.clearBelow(prio);
  const text = payload.text || `[${substate}]`;
  const actions = Array.isArray(payload.actions) ? payload.actions : defaultActionsFor(substate);
  const blockInput = payload.blockInput !== false; // block by default
  OverlayManager.present({ id: substate, priority: prio, text, actions, blockInput });
}

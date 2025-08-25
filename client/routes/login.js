// LOGIN route module — extracted from main.js without behavior changes
// Registers the LOGIN screen and shows the login modal/backdrop.

import OverlayManager from '../core/overlayManager.js';
import { presentLoginModal, showLoginBackdrop } from '../modals/login.js';

export function registerLoginRoute({ makeScreen, APP_STATES }) {
  makeScreen(APP_STATES.LOGIN, (el) => {
    // Clear screen content; we use a modal over the full-screen renderer backdrop
    el.innerHTML = '';
    // Ensure any lingering lobby/room modal is dismissed when returning to login
    try { OverlayManager.dismiss('LOBBY_MODAL'); } catch (_) {}
    try { OverlayManager.dismiss('ROOM_MODAL'); } catch (_) {}
    showLoginBackdrop();
    presentLoginModal();
  });
}

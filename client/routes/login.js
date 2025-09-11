// LOGIN route module — extracted from main.js without behavior changes
// Registers the LOGIN screen and shows the login modal/backdrop.

import OverlayManager from '../core/overlayManager.js';
import { presentLoginModal } from '../modals/login.js';
import { ensureBanner } from '../core/ui/banner.js';
import { startLoginScenario, stopLoginScenario } from '../core/net/loginScenario.js';

export function registerLoginRoute({ makeScreen, APP_STATES, client }) {
  makeScreen(APP_STATES.LOGIN, (el) => {
    // Clear screen content; we use a modal over the full-screen renderer backdrop
    el.innerHTML = '';
    // Ensure any lingering lobby/room modal is dismissed when returning to login
    try { OverlayManager.dismiss('LOBBY_MODAL'); } catch (_) {}
    try { OverlayManager.dismiss('ROOM_MODAL'); } catch (_) {}
    presentLoginModal();
    try { ensureBanner(); window.queueBanner('Login', 1); } catch (_) {}
    // Attempt to start the shared Login Scenario room (movement-only, full FOV)
    try { startLoginScenario({ client }); } catch (_) {}
  });
  // Provide a global hook so session logic can stop the login scenario when transitioning to lobby
  try { window.stopLoginScenario = stopLoginScenario; } catch (_) {}
}

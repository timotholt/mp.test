# Hack40k TODO

Last updated: 2025-08-22

## High-Priority Next Actions
- [x] Client: LOGIN screen with “Welcome to Hack40k” + OK -> route to LOBBY
- [x] Client: LOBBY screen: list rooms via client.getAvailableRooms('nethack'), poll refresh, Create Private Room button, chat/player stubs
- [x] Client: Adjust connection flow to not auto-join; use client.create / joinById from lobby
- [ ] Server: Room metadata + host designation + password/limits for lobby list
- [ ] Server: Ready-state tracking; when all ready, host gets modal “All players ready” -> start game

## Client Tasks (Pending)
- [x] Add LOGIN screen (APP_STATES.LOGIN) and button to proceed to LOBBY
- [x] Implement LOBBY screen (APP_STATES.LOBBY):
  - [x] Rooms list with refresh (client.getAvailableRooms('nethack'))
  - [x] Create Private Room button
  - [x] Chat window stub
  - [x] Player list stub
- [x] Create room-create modal module in a separate file:
  - File: `client/modals/roomCreate.js`
  - Fields: name, turn length (s), password, max players
  - On submit: `client.create('nethack', { name, turnLength, roomPass, maxPlayers, private: true })`
- [ ] ROOM screen (APP_STATES.ROOM):
  - [x] Player list (from `room.state.players`)
  - [x] Chat stub (receive-only; shows server state.log)
  - [ ] Character setup: simple OK dialogs for class/chapter/equipment (defaults)
  - [x] “READY TO PLAY” button UI (local toggle; server wiring pending)
- [x] Adjust connect flow: do not auto-join in `client/main.js`; only join/create from lobby selection

## Server Tasks (Pending)
- [ ] App-state broadcast schema `{ state, substate, payload?, version }` (increment version)
- [ ] Pause/resume + gate AI and movement when paused
- [ ] Modal pipeline endpoints: `present/dismiss/clearBelow` and `modalAction` handler
- [ ] Set and maintain room metadata for lobby list: `{ name, turnLength, maxPlayers, private, numClients, hostName }`
- [ ] Designate creator as HOST (`hostSessionId`, `hostName`); expose in metadata/state
- [ ] Enforce join constraints: password check in `onAuth`, and `maxPlayers` in `onJoin`
- [ ] Chat broadcast (`chat` message) for lobby/room (persistence optional)
- [ ] Ready-state tracking; when all players ready -> send host modal “All players ready” (HIGH/CRITICAL)
- [ ] Start game on host confirmation -> broadcast `appState { state: GAMEPLAY_ACTIVE }`

## Completed (Client)
- [x] Micro-router using plain DOM with screens and `setRoute()` in `client/main.js`
- [x] OverlayManager with priority stack (LOW/MEDIUM/HIGH/CRITICAL)
- [x] Wire `room.onMessage('appState')` to route + present substate overlays
- [x] Input gating: only allow movement during `GAMEPLAY_ACTIVE` with no blocking modal
- [x] Preserve ASCII renderer instance; mount during gameplay screens only
 - [x] LOGIN screen + route to LOBBY
 - [x] LOBBY basics (room list polling + create room modal hook)
 - [x] Separate `client/modals/roomCreate.js` and expose `OverlayManager` globally
 - [x] Adjusted connect flow: reconnect attempt on load; no auto-join; join/create via lobby
 - [x] Stop lobby polling when leaving LOBBY to avoid timer leaks

## Key Files
- Client router/overlays: `client/main.js`
- Room-create modal (to add): `client/modals/roomCreate.js`
- Server room: `server/rooms/NethackRoom.js`
- Entity & occupancy (server): `server/rooms/gamecode/entity.js`, `server/rooms/gamecode/occupancy.js`

## Test Checklist
- [ ] Login -> Lobby route works; lobby lists rooms and refreshes
- [ ] Create private room via modal; room appears in lobby list with metadata
- [ ] Join room; player list updates; chat stubs send/receive
- [ ] Character setup dialogs send defaults; “READY TO PLAY” notifies server
- [ ] Host receives “All players ready” modal and starts game; clients route to gameplay
- [ ] Gameplay input blocked when paused or a blocking modal is shown

Footnote: If a modal interrupts your flow, it’s working as designed. Priority is the spice of WAAAGH.

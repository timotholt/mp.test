# Grimdark MP — Design Spec
*Last updated: 2026-03-21*

---

## 1. Core Philosophy

A multiplayer NetHack-style roguelike. Turn-based logic on the server (configurable tick rate, default 250ms) but feels real-time to players. Server is authoritative on all game state — clients render, input, and display only.

---

## 2. Architecture

### 2.1 Tick Rate
- Configurable per game at creation time (host setting)
- Default: 250ms/tick
- Can be adjusted by host only, mid-game via Settings tab
- At 250ms players feel fluid movement, not discrete turns

### 2.2 Server Authority
- Server controls all game state transitions
- Server controls pause/unpause
- Server controls level generation and map distribution
- Client never makes authoritative decisions — only sends input, renders state

### 2.3 Level System
- **Level 0**: The lobby level. Server-seeded, static map (dropship/base). Server owns it and can update it across versions. Sent to client on room join via same pipeline as any level.
- **Level 1+**: Procedurally generated per session by server
- All levels use identical client rendering pipeline — no special cases

---

## 3. Game States

### 3.1 State Flow
```
LOGIN → LOBBY → ROOM → [level 0 loaded] → [all ready + countdown] → GAMEPLAY_ACTIVE (level 1+)
```

### 3.2 ROOM State (Level 0 / Lobby Level)
- Player can move freely immediately on join — no gating
- Other players visible, moving around the same map
- Ready system is a UI layer only, does not block movement
- Server sends level 0 map on join (same as any level transition)

### 3.3 GAMEPLAY_ACTIVE (Level 1+)
- Full game running at configured tick rate
- All game systems active

### 3.4 Paused
- Server-authoritative — server decides if/when to honor pause
- Triggered by client sending `requestPause` (ESC key)
- All clients freeze, pause indicator shown
- Settings panel accessible while paused

---

## 4. Ready System

- Each player has a ready toggle (visible on their player card)
- Any player can mark themselves ready/unready freely
- When **all** connected players are ready → server initiates countdown
- Countdown is server-driven, broadcast to all clients
- On countdown complete → server generates level 1, sends map, transitions all clients to GAMEPLAY_ACTIVE
- If a player unreadies during countdown → countdown cancels

---

## 5. Layout

```
┌─────────────────────────────────────────────────────┐
│  [Player Card] [Player Card] [Player Card] ...       │  ~60-80px
├─────────────────────────────────────────────────────┤
│                                                      │
│                                                      │
│                    MAP / RENDERER                    │  fills remaining space
│                                                      │
│                                                      │
├─────────────────────────────────────────────────────┤
│  Game | Chat | Whisper | Server | ⚙ Settings        │  ~100-120px collapsed
└─────────────────────────────────────────────────────┘
```

### 5.1 Player Cards (top strip)
- One card per connected player, horizontal row
- Each card shows: player name, HP bar, XP bar, Stress bar
- Ready indicator on card (toggleable by that player)
- KO state: card dimmed
- Dead state: card distinct from KO (exact visual TBD)
- Hover: expanded tooltip showing gear, stats, etc.
- Cards persist even when player is dead/KO

### 5.2 Map (middle)
- Takes all remaining space between player cards and bottom bar
- Main renderer is the only map view — no minimap
- Always rendering, always visible

### 5.3 Bottom Bar (collapsed, default)
- 4-6 lines tall
- Shows recent messages from the active tab
- No input field visible
- Unread badges on inactive tabs when new activity arrives
- Collapsed default tab: **Game**

### 5.4 Bottom Bar (expanded)
- Taller, input field visible at bottom
- Tab bar visible across top: `Game | Chat | Whisper | Server | ⚙ Settings`
- TAB key cycles through tabs while expanded
- ESC collapses back to default

---

## 6. Bottom Bar Tabs

| Tab | Input | Audience | Notes |
|-----|-------|----------|-------|
| Game | Read-only | Everyone in game | NetHack-style event log. `the jackal bites you.` etc. |
| Chat | Type here | Everyone in game | General in-game chat, this session only |
| Whisper | Type here | Sender + recipient | Combined inbox, targeting via `/name` or UI |
| Server | Read-only | Everyone | Join/leave/friend online/offline events |
| ⚙ Settings | Host edits, others read-only | Everyone sees | Tick rate, pause rules, respawn rules, etc. |

---

## 7. Keyboard Bindings

| Key | Context | Action |
|-----|---------|--------|
| Arrow keys | Gameplay | Move player (cardinal) |
| `hjkl` | Gameplay | Move player (NetHack style, TBD) |
| `Enter` | Bottom bar closed | Expand, focus Chat tab |
| `Enter` | Bottom bar open, Chat/Whisper | Send message, collapse |
| `TAB` | Bottom bar closed | Expand, focus Game tab |
| `TAB` | Bottom bar open | Cycle tabs (Game→Chat→Whisper→Server→Settings→Game) |
| `ESC` | Anywhere | Send pause request to server; if bar open, also collapse |
| `F8` | Anywhere | Toggle cinematic mode (hide all UI) |

### 7.1 Movement Gating
- Movement enabled in **both** ROOM and GAMEPLAY_ACTIVE states
- Movement disabled when: bottom bar is expanded with input focus, a blocking modal is open, game is paused

---

## 8. Blocking vs Non-Blocking UI

### Non-Blocking (game continues running)
- Bottom bar expansion (TAB / Enter)
- Spell casting UI
- Item use UI
- Player card hover tooltips
- Cinematic mode (F8)

### Blocking (server pause required)
- ESC pause request
- Group inventory (all players' inventories shown simultaneously for trading/strategy)
- Possibly: level-up choices, dialogue, cutscenes (TBD)

### Group Inventory
- Any player can request open (sends requestPause + openGroupInventory to server)
- Server decides whether to honor (based on game state)
- When open: all players see all inventories simultaneously
- Drag-to-trade between players
- Host or unanimous confirm to close and resume
- Design/tech debt: detailed UX TBD

---

## 9. Player Death States

| State | Description | Card appearance | Recoverable |
|-------|-------------|-----------------|-------------|
| Alive | Normal | Full color | — |
| KO | Knocked out, can be revived by teammate | Dimmed | Yes |
| Dead | Permanent (maybe) | Distinct visual TBD | TBD — respawn system undesigned |

- Cards always visible regardless of state
- Revival mechanics: design debt
- Respawn system: design debt

---

## 10. Design & Tech Debt (Logged)

- [ ] Floating damage numbers (visual, add later)
- [ ] KO vs Dead distinction — full mechanics undesigned
- [ ] Revival / respawn system
- [ ] Group inventory — detailed UX
- [ ] Non-blocking UI architecture — spell casting, item use flows
- [ ] Diagonal movement (client + server pipeline exists partially, not wired)
- [ ] GAMEPLAY_ACTIVE vs ROOM movement gating — fix needed now
- [ ] Renderer audit — determine what's Jason's original vs current changes, identify bugs

---

## 11. Global Lobby & Regions

### 11.1 Regions
- Every player connects to a **region server**
- Region concept baked in from day one — start with one region (`Earth`), split into US-West/US-East/etc. as load demands
- Game rooms belong to a region; friends/whisper may eventually be cross-region
- No region-switching UI needed yet — just design region-awareness into the data model now

### 11.2 Global Lobby (per region)
- The global lobby is the landing zone for the region — a persistent shared space
- Visually: players walk around a map (same renderer, same engine)
- Separate from game rooms — you're in the lobby until you create or join a game

### 11.3 Guest Access
- Players connect and enter the global lobby **immediately** — no login required
- Guests get a generated temporary name: `Guest#XXXX` (thematic alternatives TBD)
- Guests can:
  - Walk around the global lobby
  - See other players (guests and logged-in)
  - Read chat
  - See the active games list and player counts
- Guests **cannot**:
  - Send chat
  - Create or join a game
  - Access whisper, friends, persistent stats

### 11.4 Nag Bar
- Persistent but non-blocking bar shown to guests at all times
- Shows temp name + `[Sign Up]` `[Log In]` `[Maybe Later]`
- "Maybe Later" hides it for the session, reappears next visit
- When a guest attempts a login-required action (chat, join game), nag bar pulses or a small contextual prompt appears
- Login/signup upgrades identity **in place** — no disconnect, no rejoin

---

## 12. Next Steps (ordered)

1. **Renderer audit** — evaluate current renderer: what works, what's broken, what's Jason's vs local changes. Decide: fix forward or roll back to known-good baseline with tweaks.
2. **Movement fix** — enable movement in ROOM state (unblocks all manual testing)
3. **Layout rebuild** — player cards top, map middle, bottom bar collapsed/expanded
4. **Bottom bar tabs** — Game, Chat, Whisper, Server, Settings
5. **Ready system** — wire ready toggle on player cards, server countdown, level transition
6. **Level 0 map** — server sends lobby map on join, same pipeline as level transitions
7. **Global lobby** — guest access, nag bar, region concept in data model

ot stupid. It’s a pragmatic smoke test that exercises renderer + room + gameState plumbing with minimal risk. Let’s lock the spec and then I’ll fold it into the docs and scaffold stubs next.

Recommended design (Login Scenario)

Server room: server/rooms/LoginScenarioRoom
Single shared instance named login created at server boot if enabled.
Max clients: 32.
Accepts unauthenticated clients (no Supabase login required).
Flags (enforced server-side):
canMove = true
canDamage = false
canAffect = false
canInteract = false
canChat = false
noPersistence = true
Throttle/broadcast: tick at 100 ms (configurable; allow 200 ms).
JWT handling: if a client presents a JWT and it expires, kick them from the room.
FOV: stubbed to “full visibility” (server sends full level; no FOV gating).
Level: deterministic static 60×40 “spaceport_login” level with:
Smooth sci‑fi walls, black marble floor.
A blue “@” at center for each connected client (movement-only).
Rate limiting: reuse full-game session rate limits.
Server boot flow
CreateScenario(LOGIN)
LoadScenario(LOGIN, ANYONECANCONNECT, LEAVE_ON_LOGIN, NO_PERSISTENCE)
If LOGIN_SCENARIO_ENABLED=false, skip creating the room.
Client behavior (no Pixi; use your existing renderer)
If connected to server and login room exists, join login.
Render the server-provided level behind the login UI; show other players’ “@”.
Arrow/WASD movement → send moveIntent(dx,dy). Server snaps and echoes positions.
If server is unreachable or feature disabled, draw no dungeon on the canvas.
On successful auth (Supabase), automatically leave login and join the Lobby scenario.
Data model (minimal)
State
level: arrays/bitsets per map+entities doc (static; sent once or cached)
players: Map<sessionId, { id, x, y, glyph:'@', color:'#3AAFFF' }>
Messages
client → server: moveIntent { dx, dy }
server → client: state patches (positions), periodic at 100–200 ms
FOV stub
Vision system flag FOV_MODE='full' for the login room. In later builds, we can swap to proper FOV while keeping behavior toggled by room flags.
Transition to Lobby
On login success, client leaves login and joins lobby (similar room but allows chat and larger map). “LEAVE_ON_LOGIN” behavior is handled client-side and sanity-checked server-side.
Server config toggles

LOGIN_SCENARIO_ENABLED=true|false
LOGIN_TICK_MS=100 (allow 200)
LOGIN_MAX_CLIENTS=32
LOGIN_LEAVE_ON_LOGIN=true
LOGIN_NO_PERSISTENCE=true
Answers to your numbered goals

Server setting to disable it: yes (LOGIN_SCENARIO_ENABLED).
Run the full renderer without login: yes—this is exactly the point.
Tests room functionality before the lobby: yes—basic join, state sync, movement, rate-limits.
Tests server↔client gameState without auth: yes—unauth join, movement, state deltas; plus JWT kick path if token provided.
Open confirmations (quick yes/no)

Show all players’ “@” to each other in login room: yes (as per your note).
Center spawn: place each new client at center (W/2,H/2) and allow movement across open floor. OK?
Colors: fixed blue “@” (#3AAFFF) for everyone, for simplicity. OK?
Throttle default 100 ms, configurable to 200 ms: OK?
Static level source: use a dedicated function in shared/dungeon/generator.js named makeSpaceportLoginLevel() to return the 60×40 arrays/bitsets. OK?
Implementation plan (doc‑first, then stubs)

Update docs (no code yet):
docs/generation_pipeline.md: add “Special Scenarios: Login Scenario” section describing flags, data flow, and boot behavior.
docs/map_and_entities_architecture.md: add a short “FOV stub” note and room flags block.
Scaffold (tiny, JS-only, ≤150 LOC each):
server/rooms/LoginScenarioRoom.js with config guard, movement-only logic, tick throttle, JWT kick hook, full-visibility mode.
shared/dungeon/generator.js: add makeSpaceportLoginLevel() returning the static 60×40 level.
client/routes/login.js: conditional join of login room; leave on auth; render behind login UI.
No persistence, no HTML/CSS changes.
If you confirm the five OKs above, I’ll update the docs and scaffold the stubs accordingly.

Tiny joke: It’s not a lobby, it’s a pre‑party. Everyone shows up, nobody talks, and the only dance move allowed is the cardinal step.
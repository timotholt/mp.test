# MMO Chat System Specification (Supabase/Postgres-first)

This spec defines a chat backend for an MMO using Supabase/Postgres as the sole enforcement layer.  
It covers:
- Public chat rooms (regional lobbies, news, status, gm, game)
- Private game rooms with visit windows (no transcript after you leave; rejoining starts fresh)
- Direct messages (DMs/whispers) with full history
- Blocking semantics: pre-block messages remain, post-block hidden both ways
- Login gating: public rooms since join; per-message override for status; news/DMs always full history
- RLS ensures clients cannot bypass rules

---

## 1. Types

```sql
create type room_type   as enum ('lobby','game','news','status','gm');
create type login_scope as enum ('room','dm');
2. Tables
Users
sql
Copy code
create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle  text unique
);
Rooms
sql
Copy code
create table if not exists rooms (
  id        text primary key,  -- e.g. 'wc:lobby','game:uuid'
  type      room_type not null,
  region    text null,
  title     text not null,
  is_private boolean not null default false,
  owner_id   uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at  timestamptz null,
  default_login_gated boolean not null default true
);
Public messages
sql
Copy code
create table if not exists chat_messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    text not null references rooms(id) on delete cascade,
  from_user  uuid null references auth.users(id) on delete set null, -- NULL=system
  text       text not null check (length(text) <= 4000),
  ts         timestamptz not null default now(),
  login_gated boolean not null default true,
  deleted_at  timestamptz null
);
create index if not exists idx_chat_room_ts on chat_messages (room_id, ts);
Blocks
sql
Copy code
create table if not exists blocks (
  blocker    uuid not null references auth.users(id) on delete cascade,
  blocked    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  revoked_at timestamptz null,
  primary key (blocker, blocked, created_at)
);
create index if not exists idx_blocks_all on blocks (blocker, blocked, created_at, revoked_at);
Session logins (public room gating, DM UI state)
sql
Copy code
create table if not exists session_logins (
  user_id   uuid not null references auth.users(id) on delete cascade,
  scope     login_scope not null,
  key       text not null,
  login_at  timestamptz not null default now(),
  primary key (user_id, scope, key)
);
Private room membership
sql
Copy code
create table if not exists room_members (
  room_id text not null references rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role    text null,
  joined_at timestamptz not null default now(),
  left_at   timestamptz null,
  primary key (room_id,user_id)
);
Private room visits
sql
Copy code
create table if not exists room_visits (
  user_id    uuid not null references auth.users(id) on delete cascade,
  room_id    text not null references rooms(id) on delete cascade,
  entered_at timestamptz not null default now(),
  left_at    timestamptz null,
  primary key (user_id, room_id, entered_at)
);
DMs (conversations, participants, messages)
sql
Copy code
create table if not exists dm_conversations (
  id         uuid primary key default gen_random_uuid(),
  is_group   boolean not null default false,
  pair_key   text unique,
  created_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists dm_participants (
  conversation_id uuid not null references dm_conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at   timestamptz null,
  muted     boolean not null default false,
  last_read_ts timestamptz null,
  primary key (conversation_id,user_id)
);

create table if not exists dm_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references dm_conversations(id) on delete cascade,
  from_user       uuid not null references auth.users(id) on delete cascade,
  text            text not null check (length(text) <= 4000),
  ts              timestamptz not null default now(),
  deleted_at      timestamptz null
);
create index if not exists idx_dm_conv_ts on dm_messages (conversation_id, ts);
3. RLS enable
sql
Copy code
alter table rooms           enable row level security;
alter table chat_messages   enable row level security;
alter table blocks          enable row level security;
alter table session_logins  enable row level security;
alter table room_members    enable row level security;
alter table room_visits     enable row level security;
alter table dm_conversations enable row level security;
alter table dm_participants  enable row level security;
alter table dm_messages      enable row level security;
4. RLS policies (key points)
Blocks
sql
Copy code
create policy blocks_read on blocks for select using (blocker=auth.uid());
create policy blocks_ins  on blocks for insert with check (blocker=auth.uid());
create policy blocks_upd  on blocks for update using (blocker=auth.uid()) with check (blocker=auth.uid());
Session logins
sql
Copy code
create policy sl_rw on session_logins for all
  using (user_id=auth.uid()) with check (user_id=auth.uid());
Public room messages (chat_messages)
Public rooms:

login_gated=true → since join (session_logins)

login_gated=false → always visible

Private rooms:

Must be a member

Must have a visit window covering the message timestamp

Blocks enforced both directions (post-block hidden)

System posts (from_user IS NULL) bypass blocks

(see long SQL in previous message — omitted here for brevity, but include in your DB)

Private rooms insert
Only members with an open room_visits row can post.

DMs
Visible only to participants

No login gating (full history)

Block windows enforced

Insert only if participant and from_user=auth.uid()

5. RPC helpers
sql
Copy code
-- Public room join
create or replace function join_room(p_room text) returns void ...

-- Private room enter/leave
create or replace function enter_room(p_room text) returns void ...
create or replace function leave_room(p_room text) returns void ...

-- DMs
create or replace function get_or_create_dm(p_other uuid) returns uuid ...
create or replace function join_dm(p_other uuid) returns void ...

-- Blocking
create or replace function block_user(p_blocked uuid) returns void ...
create or replace function unblock_user(p_blocked uuid) returns void ...
6. Client contract
Public lobby/game: rpc('join_room',{p_room}) → subscribe to chat_messages filtered by room.

Private room: rpc('enter_room',{p_room}) before chatting, rpc('leave_room',{p_room}) on exit. Only messages in your current visit window are visible.

DMs: rpc('get_or_create_dm',{p_other}), then subscribe to dm_messages. Full history, blocks enforced.

News/Status/GM: insert with login_gated=false for global announcements or true for “only-if-online.”

Blocks: rpc('block_user',{p_blocked}) hides future messages both ways; unblock_user ends the window.

7. Semantics
Lobby/game: since-join gating.

Private room: like a lobby, but visit-window based — leaving & rejoining resets your view (no backscroll).

Status/GM: per-message login_gated.

News: always visible, months/years scroll.

DMs: full history, block windows applied.

Blocks: MMO-standard (pre-block visible, post-block hidden).
# mp.test



Create profile table in supabase.  Copy and paste from --1)

===== CUT BELOW THIS LINE
-- 1) Create table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  user_since timestamptz default now(),
  games_played int default 0,
  hours_played int default 0,
  contributed_cents int default 0
);

-- 2) Enable RLS
alter table public.profiles enable row level security;

-- 3) Policies (run once; will fail if re-run and already exist)
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
===== CUT ABOVE THIS LINE


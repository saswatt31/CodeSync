-- ============================================================
-- CodeSync — Supabase SQL Schema
-- Run this in your Supabase SQL editor (Database > SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── Profiles ────────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  email text unique not null,
  created_at timestamptz default now()
);

-- ── Sessions ─────────────────────────────────────────────────
create table if not exists sessions (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text default '',
  language text default 'javascript',
  invite_code text unique not null,
  host_id uuid references profiles(id) on delete set null,
  host_username text,
  code_content text default '',
  status text default 'active' check (status in ('active', 'ended')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  ended_at timestamptz
);

-- ── Participants ─────────────────────────────────────────────
create table if not exists participants (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references sessions(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  username text,
  role text default 'candidate' check (role in ('interviewer', 'candidate')),
  joined_at timestamptz default now(),
  unique(session_id, user_id)
);

-- ── Session events (replay) ──────────────────────────────────
create table if not exists session_events (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references sessions(id) on delete cascade,
  user_id uuid references profiles(id) on delete set null,
  username text,
  type text not null,       -- 'op', 'execution', 'language_change', etc.
  data jsonb default '{}',  -- the operation or event payload
  timestamp timestamptz default now()
);

-- ── Interviewer notes ────────────────────────────────────────
create table if not exists interviewer_notes (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references sessions(id) on delete cascade,
  interviewer_id uuid references profiles(id) on delete cascade,
  notes text default '',
  updated_at timestamptz default now(),
  unique(session_id, interviewer_id)
);

-- ── Row Level Security ───────────────────────────────────────
alter table profiles enable row level security;
alter table sessions enable row level security;
alter table participants enable row level security;
alter table session_events enable row level security;
alter table interviewer_notes enable row level security;

-- Profiles: users can read all profiles, only update their own
create policy "Public profiles readable" on profiles for select using (true);
create policy "Own profile editable" on profiles for update using (auth.uid() = id);

-- Sessions: readable by participants, manageable by host
create policy "Sessions readable by participants" on sessions
  for select using (
    host_id = auth.uid() or
    exists (
      select 1 from participants 
      where session_id = sessions.id 
      and user_id = auth.uid()
    )
  );
create policy "Sessions insertable by auth users" on sessions
  for insert with check (auth.uid() is not null);
create policy "Sessions updatable by host" on sessions
  for update using (host_id = auth.uid());

-- Participants: readable by session participants
create policy "Participants readable" on participants
  for select using (
    user_id = auth.uid() or
    exists (
      select 1 from sessions 
      where id = participants.session_id 
      and host_id = auth.uid()
    )
  );
create policy "Participants insertable" on participants
  for insert with check (auth.uid() is not null);

-- Session events: readable by participants
create policy "Events readable by participants" on session_events
  for select using (
    exists (
      select 1 from sessions 
      where id = session_events.session_id 
      and (
        host_id = auth.uid() or 
        exists (
          select 1 from participants 
          where session_id = sessions.id 
          and user_id = auth.uid()
        )
      )
    )
  );
create policy "Events insertable by participants" on session_events
  for insert with check (auth.uid() is not null);

-- Interviewer notes: only the interviewer can read/write
create policy "Notes only for interviewer" on interviewer_notes
  for all using (interviewer_id = auth.uid());

-- ── Indexes ──────────────────────────────────────────────────
create index if not exists idx_sessions_host on sessions(host_id);
create index if not exists idx_sessions_invite on sessions(invite_code);
create index if not exists idx_participants_session on participants(session_id);
create index if not exists idx_participants_user on participants(user_id);
create index if not exists idx_events_session on session_events(session_id);
create index if not exists idx_events_timestamp on session_events(timestamp);
create index if not exists idx_notes_session on interviewer_notes(session_id);

-- ── Updated_at trigger ───────────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger sessions_updated_at
  before update on sessions
  for each row execute function update_updated_at();

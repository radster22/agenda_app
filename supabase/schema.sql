-- Run once in Supabase: SQL Editor -> New query -> paste all of this -> Run.

create table if not exists public.members (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 200)
);

create table if not exists public.agendas (
  id bigint generated always as identity primary key,
  member_id bigint not null references public.members (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  done boolean not null default false,
  binned_at timestamptz  -- set when moved to the Bin
);

create index if not exists agendas_member_id_idx on public.agendas (member_id);

-- Anyone with the app link can read and edit (no login).
alter table public.members enable row level security;
alter table public.agendas enable row level security;

drop policy if exists "public access" on public.members;
drop policy if exists "public access" on public.agendas;
create policy "public access" on public.members for all to anon, authenticated using (true) with check (true);
create policy "public access" on public.agendas for all to anon, authenticated using (true) with check (true);

grant select, insert, update, delete on public.members, public.agendas to anon, authenticated;

-- Push changes live to every open browser
alter publication supabase_realtime add table public.members, public.agendas;

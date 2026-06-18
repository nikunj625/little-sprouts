-- Little Sprouts — initial schema (idempotent; safe to re-run)
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Family',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz default now()
);
create table if not exists household_members (
  household_id uuid references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'parent',
  created_at timestamptz default now(),
  primary key (household_id, user_id)
);
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null, type text not null default 'child',
  age int, weight numeric, protein_per_kg numeric default 1.0,
  color text default 'A', reminder_time text, sort int default 0,
  created_at timestamptz default now()
);
create table if not exists habits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  scope text not null default 'child', category text not null,
  label text not null, active boolean default true, sort int default 0
);
create table if not exists daily_logs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  log_date date not null, habits jsonb default '{}'::jsonb,
  meals jsonb default '[]'::jsonb, notes text default '',
  updated_at timestamptz default now(), unique (member_id, log_date)
);
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  title text not null, kind text not null default 'count',
  target numeric, current numeric default 0, unit text,
  due_date date, done boolean default false, created_at timestamptz default now()
);
create table if not exists weights (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  member_id uuid references members(id) on delete cascade,
  log_date date not null, kg numeric not null, unique (member_id, log_date)
);
create table if not exists schedule (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  time text not null, activity text not null,
  category text default 'Routine', sort int default 0
);
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth text not null,
  created_at timestamptz default now()
);

create or replace function public.is_member(h uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from household_members hm where hm.household_id = h and hm.user_id = auth.uid());
$$;

alter table households enable row level security;
alter table household_members enable row level security;
alter table members enable row level security;
alter table habits enable row level security;
alter table daily_logs enable row level security;
alter table goals enable row level security;
alter table weights enable row level security;
alter table schedule enable row level security;
alter table push_subscriptions enable row level security;

drop policy if exists hh_sel on households;
create policy hh_sel on households for select using (is_member(id));
drop policy if exists hh_ins on households;
create policy hh_ins on households for insert with check (auth.uid() is not null);
drop policy if exists hh_upd on households;
create policy hh_upd on households for update using (is_member(id));

drop policy if exists hm_sel on household_members;
create policy hm_sel on household_members for select using (is_member(household_id));
drop policy if exists hm_ins on household_members;
create policy hm_ins on household_members for insert with check (user_id = auth.uid() or is_member(household_id));
drop policy if exists hm_del on household_members;
create policy hm_del on household_members for delete using (is_member(household_id));

do $$ declare t text;
begin
  foreach t in array array['members','habits','daily_logs','goals','weights','schedule'] loop
    execute format('drop policy if exists %1$s_all on %1$s;', t);
    execute format('create policy %1$s_all on %1$s for all using (is_member(household_id)) with check (is_member(household_id));', t);
  end loop;
end $$;

drop policy if exists ps_all on push_subscriptions;
create policy ps_all on push_subscriptions for all
  using (is_member(household_id)) with check (is_member(household_id) and user_id = auth.uid());

-- realtime (idempotent)
do $$
declare tbl text;
begin
  foreach tbl in array array['daily_logs','members','goals','weights'] loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=tbl) then
      execute format('alter publication supabase_realtime add table %I', tbl);
    end if;
  end loop;
end $$;

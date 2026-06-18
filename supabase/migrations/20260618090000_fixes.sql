-- Post-launch fixes (applied live 2026-06-18)

-- 1. Auto-confirm new signups so no email-link click is needed (family app, low risk).
create or replace function public.auto_confirm_user()
returns trigger language plpgsql security definer set search_path = auth as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists trg_auto_confirm on auth.users;
create trigger trg_auto_confirm
  before insert on auth.users
  for each row execute function public.auto_confirm_user();

-- 2. Fix "create family" failure: the insert's read-back was blocked by the
-- select policy (creator isn't a member yet at that instant). Track created_by
-- and let the creator read/update their own household.
alter table households add column if not exists created_by uuid default auth.uid();

drop policy if exists hh_sel on households;
create policy hh_sel on households for select
  using (is_member(id) or created_by = auth.uid());

drop policy if exists hh_upd on households;
create policy hh_upd on households for update
  using (is_member(id) or created_by = auth.uid());

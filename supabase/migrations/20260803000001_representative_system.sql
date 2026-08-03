-- =============================================================================
-- KARAY Models — Representative system overhaul
--
-- Adds the representative lifecycle (status, phone, last login), a centralized
-- audit log for non-model actions, soft-delete for notes, and a per-item
-- onboarding lock so a representative cannot change a checklist item after it
-- has been marked complete.
-- =============================================================================

-- ----- Helper: ensure the representative-assignment predicate exists --------
-- Production already knows this name; fresh environments get it here.
create or replace function public.is_assigned_representative(target_model uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_user()
    and exists (
      select 1 from public.models m
       where m.id = target_model
         and m.representative_id = auth.uid()
    )
$$;

grant execute on function public.is_assigned_representative(uuid) to authenticated;

-- ----- Profiles: contact, status, and audit columns -------------------------
alter table public.profiles
  add column if not exists email               text,
  add column if not exists phone               text,
  add column if not exists status              text not null default 'ativa',
  add column if not exists last_login_at       timestamptz,
  add column if not exists status_changed_at   timestamptz,
  add column if not exists status_changed_by   uuid references public.profiles(id) on delete set null;

-- Constrain status to the three Portuguese labels used by the management UI.
alter table public.profiles
  drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check
  check (status in ('ativa', 'inativa', 'arquivada'));

-- Backfill e-mails from auth.users for environments that can read it.
do $$
begin
  update public.profiles p
     set email = u.email
    from auth.users u
   where p.id = u.id
     and p.email is distinct from u.email;
exception when insufficient_privilege then
  raise notice 'Could not backfill profiles.email from auth.users: insufficient privilege';
end $$;

-- Existing representatives: keep active reps as ativa, inactive ones as inativa.
-- The trigger below will keep active in sync.
update public.profiles
   set status = case when active then 'ativa' else 'inativa' end
 where role = 'representative';

-- Single trigger that guards privileged columns, syncs active from status for
-- representatives, and timestamps status changes. Runs on every insert/update.
create or replace function public.manage_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Role changes are owner-only; status/active changes are staff-level.
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role and not public.is_owner() then
      raise exception 'Apenas o proprietário pode alterar o papel.' using errcode = '42501';
    end if;

    if (new.active is distinct from old.active
        or new.status is distinct from old.status)
       and not public.is_staff()
    then
      raise exception 'Apenas a equipe pode alterar status ou ativação.' using errcode = '42501';
    end if;
  end if;

  -- Representative active flag follows status.
  if new.role = 'representative' then
    new.active := (new.status = 'ativa');
  end if;

  -- Track when status changed (who changed it is set by the application).
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;

  return new;
end $$;

drop trigger if exists trg_guard_profile_cols on public.profiles;
drop trigger if exists trg_sync_profile_active_from_status on public.profiles;
drop trigger if exists trg_timestamp_profile_status_change on public.profiles;
create trigger trg_manage_profile_columns
  before insert or update on public.profiles
  for each row execute function public.manage_profile_columns();

-- ----- Profiles RLS refresh -------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using ( id = auth.uid() or public.is_staff() );

-- Admins may manage representative lifecycle columns; the trigger still reserves
-- role/active changes for staff and role changes for the owner.
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using ( public.is_staff() )
  with check ( public.is_staff() );

-- Only the owner may permanently delete a staff/representative account.
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using ( public.is_owner() );

-- ----- System audit log for cross-cutting actions ---------------------------
create table if not exists public.system_audit_log (
  id                      uuid primary key default gen_random_uuid(),
  action                  text not null,
  target_type             text,
  target_id               uuid,
  target_name             text,
  model_id                uuid references public.models(id) on delete set null,
  previous_value          jsonb,
  new_value               jsonb,
  actor_id                uuid not null references public.profiles(id) on delete set null,
  actor_name              text,
  actor_role              text,
  source                  text,
  summary                 text,
  impersonated_user_id    uuid references public.profiles(id) on delete set null,
  impersonated_user_name  text,
  created_at              timestamptz not null default now()
);

create index if not exists system_audit_log_actor_idx on public.system_audit_log(actor_id);
create index if not exists system_audit_log_target_idx on public.system_audit_log(target_type, target_id);
create index if not exists system_audit_log_created_at_idx on public.system_audit_log(created_at desc);

alter table public.system_audit_log enable row level security;

drop policy if exists system_audit_log_select on public.system_audit_log;
create policy system_audit_log_select on public.system_audit_log
  for select to authenticated
  using ( public.is_staff() or actor_id = auth.uid() );

drop policy if exists system_audit_log_insert on public.system_audit_log;
create policy system_audit_log_insert on public.system_audit_log
  for insert to authenticated
  with check ( public.is_staff() );

grant select, insert on public.system_audit_log to authenticated;

-- ----- model_notes: soft delete + creation context --------------------------
alter table public.model_notes
  add column if not exists deleted_at       timestamptz,
  add column if not exists deleted_by       uuid references public.profiles(id) on delete set null,
  add column if not exists deleted_by_name  text,
  add column if not exists created_context  text;

-- ----- model_notes RLS: staff + assigned rep sees only own notes -------------
drop policy if exists notes_select_staff_only on public.model_notes;
drop policy if exists notes_insert_staff_only on public.model_notes;
drop policy if exists notes_update_staff_only on public.model_notes;
drop policy if exists notes_select on public.model_notes;
drop policy if exists notes_insert on public.model_notes;
drop policy if exists notes_update on public.model_notes;

create policy notes_select on public.model_notes
  for select to authenticated
  using (
    public.is_staff()
    or (
      author_id = auth.uid()
      and public.is_assigned_representative(model_id)
      and deleted_at is null
    )
  );

create policy notes_insert on public.model_notes
  for insert to authenticated
  with check (
    public.is_staff()
    or (
      author_id = auth.uid()
      and public.is_assigned_representative(model_id)
    )
  );

create policy notes_update on public.model_notes
  for update to authenticated
  using ( public.is_staff() )
  with check ( public.is_staff() );

-- ----- Onboarding per-item lock for representatives ---------------------------
create or replace function public.guard_onboarding_item_rep_lock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(old.completed, false)
     and public.is_assigned_representative(old.model_id)
     and not public.is_staff()
  then
    raise exception 'Etapa concluída: o representante não pode alterá-la.' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_onboarding_item_rep_lock on public.model_onboarding_items;
create trigger trg_onboarding_item_rep_lock
  before update on public.model_onboarding_items
  for each row execute function public.guard_onboarding_item_rep_lock();

revoke execute on function public.guard_onboarding_item_rep_lock() from public;
revoke execute on function public.guard_onboarding_item_rep_lock() from anon;
revoke execute on function public.guard_onboarding_item_rep_lock() from authenticated;

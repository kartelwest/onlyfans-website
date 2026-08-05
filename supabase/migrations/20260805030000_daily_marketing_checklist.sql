-- =============================================================================
-- KARAY Models — the DAILY marketing checklist.
--
-- A second, independent checklist next to the onboarding one. Onboarding is
-- done once; this is the work that repeats every day across OnlyFans, X,
-- Reddit, Instagram, TikTok, YouTube and Facebook. It therefore has NO
-- completion lock: reaching 100% today says nothing about tomorrow.
--
-- NOTE ON DRIFT (same caveat as 20260803000000): written against the LIVE
-- schema, where the role predicates are public.is_staff(), public.is_owner(),
-- public.is_assigned_representative(uuid) and public.owns_model(uuid).
--
-- What this adds:
--   1. public.model_daily_checklist_items — one row per model per step, with
--      a tick box and an optional free-text note.
--   2. models.daily_percentage — a trigger-maintained projection of those
--      rows, so /admin/models can colour the DAILY badge from one column
--      instead of loading every item for every model.
--   3. RLS mirroring the onboarding checklist: staff and the assigned
--      representative may read and write; the model herself may read.
-- =============================================================================

-- ----- 1. The items ----------------------------------------------------------
create table if not exists public.model_daily_checklist_items (
  id             uuid primary key default gen_random_uuid(),
  model_id       uuid not null references public.models(id) on delete cascade,
  -- "<section>.<item>", built by lib/daily/definition.ts. Permanent: progress
  -- is matched on (model_id, item_key), so renaming a key orphans the row.
  item_key       text not null,
  section_key    text not null,
  section_order  integer not null default 0,
  item_order     integer not null default 0,
  completed      boolean not null default false,
  completed_at   timestamptz,
  completed_by   uuid references public.profiles(id) on delete set null,
  -- Optional. The note box is closed until someone opens it, and a step is
  -- complete with or without one.
  notes          text,
  updated_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint model_daily_checklist_items_unique unique (model_id, item_key)
);

comment on table public.model_daily_checklist_items is
  'The daily marketing checklist. Seeded from lib/daily/definition.ts; one row per model per step. Unlike onboarding, it is never locked.';

create index if not exists model_daily_checklist_items_model_idx
  on public.model_daily_checklist_items (model_id, section_order, item_order);

drop trigger if exists trg_model_daily_items_updated_at
  on public.model_daily_checklist_items;
create trigger trg_model_daily_items_updated_at
  before update on public.model_daily_checklist_items
  for each row execute function public.set_updated_at();

-- completed_at follows `completed` rather than being written by the caller, so
-- "concluído em …" can never disagree with the box.
create or replace function public.sync_daily_completed_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.completed and (old.completed is distinct from true) then
    new.completed_at = now();
  elsif not new.completed then
    new.completed_at = null;
    new.completed_by = null;
  end if;
  return new;
end $$;

drop trigger if exists trg_daily_completed_at on public.model_daily_checklist_items;
create trigger trg_daily_completed_at
  before update on public.model_daily_checklist_items
  for each row execute function public.sync_daily_completed_at();

-- ----- 2. models.daily_percentage --------------------------------------------
alter table public.models
  add column if not exists daily_percentage integer not null default 0;

comment on column public.models.daily_percentage is
  'Trigger-maintained projection of model_daily_checklist_items. Never written by hand — see public.sync_model_daily_progress().';

-- 20260724000002 revoked table-wide SELECT on public.models and re-granted it
-- column by column, so a NEW column is invisible to `authenticated` until it
-- is granted explicitly. Without this the DAILY badge reads as an error.
grant select (daily_percentage) on public.models to authenticated;

create or replace function public.sync_model_daily_progress()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target      uuid;
  total_items integer;
  done_items  integer;
  pct         integer;
begin
  -- NEW is unassigned in a DELETE trigger and OLD in an INSERT trigger.
  if tg_op = 'DELETE' then
    target := old.model_id;
  else
    target := new.model_id;
  end if;

  select count(*), count(*) filter (where completed)
    into total_items, done_items
    from public.model_daily_checklist_items
   where model_id = target;

  pct := case
           when total_items = 0 then 0
           else round((done_items::numeric / total_items) * 100)
         end;

  update public.models
     set daily_percentage = pct
   where id = target
     and daily_percentage is distinct from pct;

  return null;
end $$;

drop trigger if exists trg_daily_progress on public.model_daily_checklist_items;
create trigger trg_daily_progress
  after insert or update or delete on public.model_daily_checklist_items
  for each row execute function public.sync_model_daily_progress();

-- ----- 3. RLS ----------------------------------------------------------------
alter table public.model_daily_checklist_items enable row level security;

drop policy if exists daily_select on public.model_daily_checklist_items;
create policy daily_select on public.model_daily_checklist_items
  for select to authenticated
  using (
    public.is_staff()
    or public.is_assigned_representative(model_id)
    or public.owns_model(model_id)
  );

drop policy if exists daily_insert on public.model_daily_checklist_items;
create policy daily_insert on public.model_daily_checklist_items
  for insert to authenticated
  with check (
    public.is_staff()
    or public.is_assigned_representative(model_id)
  );

drop policy if exists daily_update on public.model_daily_checklist_items;
create policy daily_update on public.model_daily_checklist_items
  for update to authenticated
  using (
    public.is_staff()
    or public.is_assigned_representative(model_id)
  )
  with check (
    public.is_staff()
    or public.is_assigned_representative(model_id)
  );

-- Removing a step is a change to the process itself, not to a model's
-- progress — owner only.
drop policy if exists daily_delete on public.model_daily_checklist_items;
create policy daily_delete on public.model_daily_checklist_items
  for delete to authenticated
  using ( public.is_owner() );

grant select, insert, update, delete
  on public.model_daily_checklist_items to authenticated;

-- anon would otherwise hold a full set of grants from Supabase's default
-- privileges. RLS denies it every row anyway; holding the privilege as well is
-- what we do not want.
revoke all on public.model_daily_checklist_items from anon;

-- The triggers are called by the table, never directly.
revoke execute on function public.sync_model_daily_progress() from public;
revoke execute on function public.sync_model_daily_progress() from anon;
revoke execute on function public.sync_model_daily_progress() from authenticated;
revoke execute on function public.sync_daily_completed_at() from public;
revoke execute on function public.sync_daily_completed_at() from anon;
revoke execute on function public.sync_daily_completed_at() from authenticated;

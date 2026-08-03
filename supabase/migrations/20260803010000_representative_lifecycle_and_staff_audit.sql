-- =============================================================================
-- KARAY Models — representative lifecycle (active / inactive / archived) and a
-- staff-level audit log
--
-- WHY THIS EXISTS: a representative could only ever be `active = true/false`,
-- and nothing recorded who flipped it. There was no way to retire a rep while
-- keeping their history, and no way to answer "who deactivated her, and when".
--
-- HOW THE THREE STATES ARE STORED — deliberately WITHOUT a new enum:
--
--   Ativo     -> active = true,  archived_at is null
--   Inativo   -> active = false, archived_at is null
--   Arquivado -> active = false, archived_at = <timestamp>
--
-- profiles.active stays the ONE column every login gate and RLS helper reads
-- (public.is_active_user(), public.is_staff(), every page guard). Archiving is
-- therefore a strictly narrower state than inactive: it cannot accidentally
-- grant access, because it always carries active = false with it. A second
-- status column would have been a second source of truth for "may this account
-- log in", which is exactly the split brain
-- 20260802000000_sync_profile_active_with_model_active.sql was written to end.
--
-- Historical records are never touched: models.representative_id keeps
-- pointing at an inactive or archived rep, so her assignments, notes and audit
-- rows stay intact and attributable.
--
-- Also adds two columns the rep management screen needs and the schema never
-- had: a contact number, and the last time the account actually signed in.
--
-- Additive only: no column is dropped, no policy is loosened, no existing
-- grant is revoked.
-- =============================================================================

-- ----- profiles: lifecycle + contact + last login ----------------------------
alter table public.profiles
  add column if not exists archived_at    timestamptz,
  add column if not exists phone          text,
  add column if not exists last_login_at  timestamptz;

comment on column public.profiles.archived_at is
  'Set when the account is archived. Always accompanied by active = false; null for active and merely inactive accounts.';

comment on column public.profiles.phone is
  'Contact number (WhatsApp) for staff accounts. A model''s number lives on models.whatsapp.';

comment on column public.profiles.last_login_at is
  'Stamped by /api/auth/record-login after a successful sign-in.';

create index if not exists profiles_archived_at_idx
  on public.profiles (archived_at)
  where archived_at is not null;

-- ----- staff_audit_log -------------------------------------------------------
-- model_audit_history is scoped to one model and is the right home for
-- anything about a model. Account-level actions have no model to hang from —
-- archiving a rep, deleting an account, entering a view-as session — so they
-- get their own log rather than a fake model_id.
create table if not exists public.staff_audit_log (
  id              uuid primary key default gen_random_uuid(),
  action          text not null,
  actor_id        uuid references public.profiles(id) on delete set null,
  actor_name      text,
  -- text, not the role enum: this row must survive a role being renamed, and
  -- the repo has already been bitten once by two enums for the same idea.
  actor_role      text,
  target_type     text not null,
  target_id       uuid,
  target_name     text,
  previous_value  text,
  new_value       text,
  -- Free-form context: { "viewAs": true, "representativeId": "…" } and so on.
  context         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists staff_audit_log_created_at_idx
  on public.staff_audit_log (created_at desc);

create index if not exists staff_audit_log_target_idx
  on public.staff_audit_log (target_type, target_id, created_at desc);

create index if not exists staff_audit_log_actor_idx
  on public.staff_audit_log (actor_id, created_at desc);

alter table public.staff_audit_log enable row level security;

-- Staff read the log; nobody writes it from a session. Every insert goes
-- through the service role in a route handler that has already authorized the
-- actor, so a representative can neither forge an entry nor erase one.
drop policy if exists staff_audit_log_select_staff on public.staff_audit_log;
create policy staff_audit_log_select_staff on public.staff_audit_log
  for select to authenticated
  using ( public.is_staff() );

revoke all on public.staff_audit_log from anon, authenticated;
grant select on public.staff_audit_log to authenticated;

-- =============================================================================
-- KARAY Models — keep profiles.active in step with models.active
--
-- WHY THIS EXISTS: a model was activated in the admin, given a new username and
-- password, and still could not log in — the portal answered "Esta conta está
-- desativada." Her auth record was healthy and last_sign_in_at proved the
-- password was accepted; the rejection came from the app afterwards.
--
-- The cause was a split brain between two columns:
--   * public.profiles.active  — the ONLY column any login gate reads
--     (app/login/LoginForm.tsx, lib/api/requireRole.ts, every page guard, and
--     the RLS helpers public.is_staff() / public.is_active_user());
--   * public.models.active    — the operational roster flag, and the only
--     thing the admin activate/deactivate control ever wrote.
--
-- Toggling her status therefore moved models.active and models.status while
-- profiles.active stayed false, so toggling her off and on again could never
-- clear the block.
--
-- SOURCE OF TRUTH: profiles.active decides whether an account may log in. It
-- is role-agnostic (owner / administrator / representative accounts have no
-- models row at all), and it is already the column every gate reads, so
-- nothing had to be rewired. models.active stays what it always was — the
-- roster flag that drives the 30-active cap, rep visibility and the Amplia
-- service enrollment — and this trigger makes it PROPAGATE to profiles.active
-- instead of drifting away from it.
--
-- DIRECTION IS ONE-WAY, deliberately: models.active -> profiles.active. A
-- second trigger pointing the other way would have two triggers on the same
-- pair of tables firing at each other. The one other place that writes
-- profiles.active on its own — the owner's user page — is fixed in application
-- code instead (app/owner/users/[id]/page.tsx).
--
-- This migration alters no column, no grant and no RLS policy. It is additive
-- and idempotent.
-- =============================================================================

create or replace function public.sync_profile_active_from_model()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Most models have no portal login yet; there is nothing to keep in step.
  if new.profile_id is null then
    return new;
  end if;

  -- Only act when the flag actually moved, or when a login was just linked to
  -- this model (a freshly provisioned profile must inherit the roster state).
  if tg_op = 'UPDATE'
     and new.active is not distinct from old.active
     and new.profile_id is not distinct from old.profile_id then
    return new;
  end if;

  update public.profiles
     set active = new.active
   where id = new.profile_id
     and active is distinct from new.active;

  return new;
end $$;

-- SECURITY DEFINER on purpose: the trigger fires under the session of the
-- administrator making the change, and the profile being updated is not their
-- own. The live profiles_update_management_only policy would permit it today,
-- but this keeps the sync working independently of future policy edits.

-- Supabase's default privileges hand every new public-schema function an
-- EXECUTE grant to anon and authenticated, which the security advisor flags as
-- {anon,authenticated}_security_definer_function_executable. Calling a trigger
-- function over /rest/v1/rpc only ever raises "trigger functions can only be
-- called as triggers", so this is not exploitable — but the grant is noise in
-- the advisor and the project already cleans these up by name (20260731010000,
-- 20260724000003). `revoke ... from public` alone does not remove the two role
-- grants, so both are named explicitly.
--
-- Revoking EXECUTE does NOT stop the trigger: PostgreSQL checks that privilege
-- when CREATE TRIGGER runs, not on each fire.
revoke execute on function public.sync_profile_active_from_model() from public;
revoke execute on function public.sync_profile_active_from_model() from anon;
revoke execute on function public.sync_profile_active_from_model() from authenticated;

drop trigger if exists trg_sync_profile_active_from_model on public.models;
create trigger trg_sync_profile_active_from_model
after insert or update of active, profile_id on public.models
for each row
execute function public.sync_profile_active_from_model();

-- ---------------------------------------------------------------------------
-- Backfill any row that is already out of step. Zero rows at the time of
-- writing (the one affected model was corrected by hand), kept so the
-- migration is still correct if applied to a database that has since drifted.
-- ---------------------------------------------------------------------------
update public.profiles p
   set active = m.active
  from public.models m
 where m.profile_id = p.id
   and p.active is distinct from m.active;

-- Fail loudly here rather than silently in the UI six weeks from now.
do $$
begin
  if exists (
    select 1
    from public.models m
    join public.profiles p on p.id = m.profile_id
    where p.active is distinct from m.active
  ) then
    raise exception 'profiles.active and models.active are still out of step after the backfill';
  end if;
end $$;

-- Rollback notes (apply manually if needed):
--   drop trigger if exists trg_sync_profile_active_from_model on public.models;
--   drop function if exists public.sync_profile_active_from_model();

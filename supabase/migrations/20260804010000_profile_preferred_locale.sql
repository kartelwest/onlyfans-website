-- =============================================================================
-- KARAY Models — the language a person reads the product in
--
-- Adds `profiles.preferred_locale` so a language choice follows a person onto
-- their next device instead of living only in that browser's cookie. The cookie
-- stays: it is what an anonymous visitor gets, and it is what makes the very
-- next render correct without waiting on a round trip.
--
-- 'pt-BR' is the default because this is a Brazilian agency. A profile created
-- before this migration is Portuguese-reading until someone says otherwise, and
-- NOT NULL DEFAULT backfills exactly that.
--
-- The CHECK is the guard rail. `preferred_locale` is a TEXT column and not a
-- Postgres enum on purpose: adding a third language should be one ALTER on a
-- constraint, not an enum migration with the locking and the ordering problems
-- that come with it. This migration does NOT touch model_status, app_role, or
-- any other existing enum.
--
-- WHY THE RPC BELOW EXISTS
--
-- Since 20260803000001_representative_system.sql, profiles_update reads
--   using ( public.is_staff() ) with check ( public.is_staff() )
-- so a model or a representative cannot write to her own profile row at all.
-- That is deliberate and worth keeping — it is what stops a rep from editing
-- her own lifecycle columns.
--
-- But every user needs to set their own language, models included. Widening
-- profiles_update to "or id = auth.uid()" would hand back write access to every
-- unguarded column on the row, which is a much larger change than a language
-- switcher should be making. So instead there is one SECURITY DEFINER function
-- that writes one column for the caller and nothing else, for nobody else.
-- =============================================================================

alter table public.profiles
  add column if not exists preferred_locale text not null default 'pt-BR';

-- Idempotent: re-running the migration must not fail on an existing constraint.
alter table public.profiles
  drop constraint if exists profiles_preferred_locale_check;

alter table public.profiles
  add constraint profiles_preferred_locale_check
  check (preferred_locale in ('pt-BR', 'en-US'));

comment on column public.profiles.preferred_locale is
  'UI language for this person. Cross-device counterpart of the NEXT_LOCALE cookie. Written by public.set_preferred_locale().';

-- -----------------------------------------------------------------------------
-- Self-service write path
-- -----------------------------------------------------------------------------
--
-- SECURITY DEFINER, so it runs past the staff-only profiles_update policy — but
-- the row it touches is pinned to auth.uid(), so it can only ever be the
-- caller's own. There is no parameter for "whose", and that is the point.
--
-- The locale argument is validated here as well as by the CHECK, so a bad value
-- comes back as a clear message rather than a constraint violation.

create or replace function public.set_preferred_locale(p_locale text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;

  if p_locale not in ('pt-BR', 'en-US') then
    raise exception 'Unsupported locale: %', p_locale using errcode = '22023';
  end if;

  update public.profiles
     set preferred_locale = p_locale
   where id = auth.uid();
end $$;

revoke all on function public.set_preferred_locale(text) from public;
grant execute on function public.set_preferred_locale(text) to authenticated;

comment on function public.set_preferred_locale(text) is
  'Sets preferred_locale on the CALLING user''s own profile. The only self-service write to profiles; every other column stays behind the staff-only policy.';

-- -----------------------------------------------------------------------------
-- The trigger that guards privileged columns needs no change
-- -----------------------------------------------------------------------------
--
-- manage_profile_columns() gates role, active, status and full_name. It does
-- not mention preferred_locale, so the update above passes through it — which
-- is correct: a language is not a privilege.

-- =============================================================================
-- KARAY Models — permanent account deletion belongs to the owner alone
--
-- FOUND BY TESTING, not by reading: an administrator could DELETE a
-- representative's profile row straight through PostgREST. The interface has
-- always reserved permanent deletion for the owner
-- (app/admin/representatives/actions.ts refuses anyone else, and only the
-- owner is shown the button), but the database disagreed.
--
-- public.profiles carried TWO delete policies, and RLS policies are permissive
-- — they OR together, so the widest one wins:
--
--   profiles_delete             using ( is_owner() )                <- intended
--   profiles_delete_management  using ( private.is_management() )   <- wider
--
-- An admin who called the API directly was therefore never stopped by anything
-- but the UI. Dropping the wider policy leaves the owner-only rule as the one
-- the database itself enforces, which is what every layer already claimed.
--
-- Verified against production before and after, inside an aborted transaction:
-- administrator DELETE went from rows=1 to rows=0, owner DELETE stayed rows=1.
--
-- Archiving stays the reversible path for everyone else (profiles.status =
-- 'arquivada'), and it keeps every historical record attached to the account.
-- =============================================================================

drop policy if exists profiles_delete_management on public.profiles;

-- Left in place deliberately, and restated here so the intent is not lost:
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles
  for delete to authenticated
  using ( public.is_owner() );

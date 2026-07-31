-- =============================================================================
-- KARAY Models — Admin-initiated global sign-out
--
-- WHY THIS EXISTS: when an administrator resets a model's password we want her
-- existing sessions to stop working. The obvious call —
-- `supabase.auth.admin.signOut(userId, 'global')` — does NOT do this: the
-- auth-js signature is `signOut(jwt: string, scope?: SignOutScope)`, so it
-- takes the user's own JWT, not a user id. Passing a user id there sends it as
-- a bearer token, GoTrue rejects it, and nothing happens. There is no
-- per-user session revocation anywhere in the admin API (createUser,
-- listUsers, getUserById, updateUserById, deleteUser, inviteUserByEmail,
-- generateLink — that is the whole surface).
--
-- So we revoke server-side instead. Deleting the rows in auth.sessions
-- cascades to auth.refresh_tokens, which means the model can no longer
-- refresh: her session cannot be extended past the access token she is
-- already holding. Access tokens are stateless JWTs, so one already issued
-- stays valid until it expires on its own (Supabase default: 1 hour) — this
-- is a hard cap on the old session, not an instant kill. In practice the
-- application's 8-minute inactivity timeout (lib/auth/inactivityConfig.ts)
-- usually ends it sooner.
--
-- SECURITY: SECURITY DEFINER (owned by postgres, which is what allows the
-- write into the auth schema) and EXECUTE granted to service_role ONLY.
-- anon and authenticated are revoked explicitly — Supabase's default
-- privileges hand every new public-schema function an EXECUTE grant to both,
-- so `revoke ... from public` alone would leave them able to call it. This
-- function takes a user id and trusts it, so it must never be reachable by a
-- logged-in user; it is called only from the server-side credential-reset
-- route, which authorizes the caller as owner/administrator first.
-- =============================================================================

create or replace function public.force_sign_out_user(target_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  delete from auth.sessions where user_id = target_user;

  get diagnostics removed = row_count;

  return removed;
end $$;

revoke execute on function public.force_sign_out_user(uuid) from public;
revoke execute on function public.force_sign_out_user(uuid) from anon;
revoke execute on function public.force_sign_out_user(uuid) from authenticated;
grant execute on function public.force_sign_out_user(uuid) to service_role;

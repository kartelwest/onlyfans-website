-- =============================================================================
-- KARAY Models — hardening picked up from the Supabase security advisor after
-- the rep-dashboard migrations above:
--
-- 1. get_model_marketing / set_model_marketing were left with the default
--    PUBLIC execute grant (advisor: anon_security_definer_function_executable,
--    authenticated_security_definer_function_executable). Both already
--    self-check public.is_management() internally so this was not
--    exploitable, but there's no reason to leave anon holding EXECUTE.
-- 2. storage_model_avatars_public_read (added in 20260724000001) allowed
--    listing every file in the model-avatars bucket (advisor:
--    public_bucket_allows_listing). The bucket is `public: true`, so Supabase
--    already serves objects via the public object URL without an RLS SELECT
--    policy — the policy added listing capability with no offsetting benefit.
-- =============================================================================

revoke execute on function public.get_model_marketing(uuid) from public;
revoke execute on function public.set_model_marketing(uuid, text, text) from public;
grant execute on function public.get_model_marketing(uuid) to authenticated;
grant execute on function public.set_model_marketing(uuid, text, text) to authenticated;

drop policy if exists storage_model_avatars_public_read on storage.objects;

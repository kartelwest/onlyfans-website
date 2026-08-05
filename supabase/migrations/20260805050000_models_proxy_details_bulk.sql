-- =============================================================================
-- KARAY Models — every model's proxy, in one call.
--
-- 20260729000000 revoked column SELECT on models.proxy_* from `authenticated`
-- and exposed one model at a time through get_model_proxy_details(uuid). The
-- Pageview screen shows every model at once, and calling that function per
-- card would mean eighteen round-trips to paint one page.
--
-- This is the same read, in bulk, with the same guard: SECURITY DEFINER, and
-- it self-checks public.is_staff() so a representative or a model calling it
-- directly through PostgREST gets an empty set rather than the agency's
-- infrastructure.
--
-- It also answers "when did this last change", which no column records: the
-- proxy fields have no updated_at of their own, so the answer comes from the
-- audit trail that already logs every proxy edit.
-- =============================================================================

create or replace function public.get_models_proxy_details(
  target_models uuid[]
)
returns table (
  model_id            uuid,
  proxy_ip            text,
  proxy_company       text,
  proxy_company_other text,
  proxy_country       text,
  proxy_updated_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.proxy_ip,
    m.proxy_company,
    m.proxy_company_other,
    m.proxy_country,
    latest.changed_at
  from public.models m
  left join lateral (
    select max(h.created_at) as changed_at
      from public.model_audit_history h
     where h.model_id = m.id
       -- Written by /api/models/proxy through logAuditEntry. `proxy_update` is
       -- the action; the field names are the columns it touched.
       and (
         h.action = 'proxy_update'
         or h.field_name in (
           'proxy_ip', 'proxy_company', 'proxy_company_other', 'proxy_country'
         )
       )
  ) latest on true
  where m.id = any (target_models)
    and public.is_staff()
$$;

revoke execute on function public.get_models_proxy_details(uuid[]) from public;
revoke execute on function public.get_models_proxy_details(uuid[]) from anon;
grant execute on function public.get_models_proxy_details(uuid[]) to authenticated;

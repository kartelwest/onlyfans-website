-- =============================================================================
-- KARAY Models — real DB-enforced Section 6 field security
--
-- The previous migration (20260724000001_rep_dashboard.sql) tried
-- `revoke select (instagram_marketing, twitter_marketing) on public.models
-- from authenticated`, assuming that would block reads. It doesn't: Postgres
-- column-level privileges are additive on top of table-level grants, not
-- restrictive. Since `authenticated` already holds table-wide SELECT on
-- `models` (required for RLS to work across every other column), a bare
-- column REVOKE while the table-wide grant remains is a no-op — confirmed by
-- introspection (has_column_privilege still returned true for both columns).
--
-- To actually block instagram_marketing / twitter_marketing reads at the ACL
-- layer for the shared `authenticated` Postgres role, we revoke table-wide
-- SELECT entirely and re-grant it column-by-column for every OTHER column.
--
-- IMPORTANT for future migrations: because table-wide SELECT is now revoked,
-- any new column added to public.models will NOT be selectable by
-- `authenticated` until it is explicitly added to this grant (or the two
-- excluded marketing columns move to their own table with its own RLS —
-- consider that instead if this column allowlist becomes hard to maintain).
-- =============================================================================
do $$
declare
  col_list text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into col_list
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'models'
     and column_name not in ('instagram_marketing', 'twitter_marketing');

  if col_list is null then
    raise exception 'models table introspection returned no columns — aborting to avoid locking out all reads';
  end if;

  execute 'revoke select on public.models from authenticated';
  execute format('grant select (%s) on public.models to authenticated', col_list);
end $$;

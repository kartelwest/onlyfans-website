-- =============================================================================
-- KARAY Models — proxy details on the model profile (owner-only)
--
-- Adds PROXY / COMPANY NAME / COUNTRY to public.models. These are internal
-- infrastructure details: every management role may READ them, only the owner
-- may WRITE them — enforced at the database level, not just hidden in the UI,
-- following the same pattern as instagram_marketing / twitter_marketing
-- (20260724000001_rep_dashboard.sql + 20260724000002_models_column_select_allowlist.sql).
--
-- Because `authenticated` is a single shared Postgres role, RLS alone cannot
-- distinguish an owner's write from an administrator's write on the same row,
-- so the columns are removed from the column-level SELECT/UPDATE grants and
-- reachable only through SECURITY DEFINER RPCs that self-check
-- public.is_staff() (read) / public.is_owner() (write).
--
-- IMPORTANT for future migrations: table-wide SELECT and UPDATE on
-- public.models are revoked; any new column must be added to the grants below
-- (re-run the do-blocks) before `authenticated` can read or write it.
-- =============================================================================

alter table public.models
  add column if not exists proxy_ip            text,
  add column if not exists proxy_company       text,
  add column if not exists proxy_company_other text,
  add column if not exists proxy_country       text;

alter table public.models
  drop constraint if exists models_proxy_company_check;

alter table public.models
  add constraint models_proxy_company_check
  check (proxy_company is null or proxy_company in ('proxy_empire', 'other'));

-- ----- column-level SELECT / UPDATE allowlists --------------------------------
do $$
declare
  restricted text[] := array[
    'instagram_marketing',
    'twitter_marketing',
    'proxy_ip',
    'proxy_company',
    'proxy_company_other',
    'proxy_country'
  ];
  select_cols text;
  update_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into select_cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'models'
     and not (column_name = any (restricted));

  if select_cols is null then
    raise exception 'models table introspection returned no columns — aborting to avoid locking out all reads';
  end if;

  -- Generated/identity columns cannot be granted for UPDATE; models has none
  -- today, but filter defensively so this block stays re-runnable.
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into update_cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'models'
     and not (column_name = any (restricted))
     and is_generated = 'NEVER'
     and is_identity = 'NO';

  execute 'revoke select on public.models from authenticated';
  execute format('grant select (%s) on public.models to authenticated', select_cols);

  execute 'revoke update on public.models from authenticated';
  execute format('grant update (%s) on public.models to authenticated', update_cols);
end $$;

-- ----- read: any management role ----------------------------------------------
create or replace function public.get_model_proxy_details(target_model uuid)
returns table (
  proxy_ip text,
  proxy_company text,
  proxy_company_other text,
  proxy_country text
)
language sql stable security definer set search_path = public as $$
  select m.proxy_ip, m.proxy_company, m.proxy_company_other, m.proxy_country
  from public.models m
  where m.id = target_model and public.is_staff()
$$;

-- ----- write: owner only -------------------------------------------------------
create or replace function public.set_model_proxy_details(
  target_model uuid,
  new_proxy_ip text,
  new_proxy_company text,
  new_proxy_company_other text,
  new_proxy_country text
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'Only the owner may edit proxy details.';
  end if;

  if new_proxy_company is not null
     and new_proxy_company not in ('proxy_empire', 'other') then
    raise exception 'Invalid proxy company: %', new_proxy_company;
  end if;

  update public.models
     set proxy_ip = new_proxy_ip,
         proxy_company = new_proxy_company,
         proxy_company_other = case
           when new_proxy_company = 'other' then new_proxy_company_other
           else null
         end,
         proxy_country = new_proxy_country
   where id = target_model;
end $$;

revoke execute on function public.get_model_proxy_details(uuid) from public;
revoke execute on function public.set_model_proxy_details(uuid, text, text, text, text) from public;
grant execute on function public.get_model_proxy_details(uuid) to authenticated;
grant execute on function public.set_model_proxy_details(uuid, text, text, text, text) to authenticated;

-- =============================================================================
-- KARAY Models — Monthly earnings, expenses/loans ledger, FX cache
--
-- NOTE ON DRIFT (same caveat as 20260724000001 / 20260731000000): this file is
-- written against the LIVE schema, confirmed by introspection, not against the
-- older migration files. In particular:
--   * the live role predicates are public.is_staff(),
--     public.is_assigned_representative(uuid) and private.is_own_model(uuid);
--     public.owns_model(uuid) was declared in 20260722000002 but never made it
--     to the live database, so it is (re)created here;
--   * profiles.role / model_audit_history.actor_role are the `app_role` enum,
--     while model_notes.created_by_role is plain text;
--   * public.model_notes has no author_id column — authorship is carried by
--     created_by / created_by_name / created_by_role.
--
-- NAMING: the feature spec asked for a new `model_monthly_earnings` table and
-- a `currency_code` column. Both already have equivalents here, so they are
-- extended instead of duplicated:
--   spec model_monthly_earnings -> public.model_earnings_reports
--        period_month           -> period_month (new column)
--        gross_usd              -> gross_revenue (USD by convention)
--        screenshot_url         -> image_path (private `model-earnings` bucket)
--        published              -> visible_to_model
--   spec models.currency_code   -> models.preferred_currency (normalized to
--                                  an ISO 4217 code by this migration)
-- `country_code` and `expenses_enabled` are genuinely new. The pre-existing
-- free-text models.country column is unused and empty in production; it is
-- deliberately left alone rather than repurposed, since country_code is
-- constrained to ISO 3166-1 alpha-2.
-- =============================================================================

-- ----- Enums -----------------------------------------------------------------
do $$ begin
  create type public.ledger_entry_type as enum ('transporte','hotel','emprestimo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ledger_provider as enum ('uber','99','indrive');
exception when duplicate_object then null; end $$;

-- ----- models: country, currency, ledger eligibility -------------------------
alter table public.models
  add column if not exists country_code      text,
  add column if not exists expenses_enabled  boolean not null default false;

alter table public.models
  drop constraint if exists models_country_code_is_alpha2;
alter table public.models
  add constraint models_country_code_is_alpha2
  check (country_code is null or country_code ~ '^[A-Z]{2}$');

-- preferred_currency is the spec's `currency_code`. It was free text, so
-- normalize the values that already look like ISO 4217 codes ('Brl' -> 'BRL').
-- Anything that does not look like a code is left untouched (no data is
-- destroyed here); the display layer validates and falls back instead.
update public.models
   set preferred_currency = upper(btrim(preferred_currency))
 where preferred_currency is not null
   and btrim(preferred_currency) ~ '^[A-Za-z]{3}$'
   and preferred_currency is distinct from upper(btrim(preferred_currency));

-- Backfill country_code for the models whose free-text nationality is
-- unambiguous, then give them the matching currency when they have none.
update public.models
   set country_code = 'BR'
 where country_code is null
   and nationality is not null
   and lower(btrim(nationality)) in ('brasil','brazil','brasileira','brasileiro');

update public.models
   set preferred_currency = 'BRL'
 where preferred_currency is null
   and country_code = 'BR';

-- expenses_enabled is deliberately NOT backfilled from country_code: it is the
-- single source of truth for the feature and starts off for every model.

-- ----- models: refresh the column-level SELECT allowlist ----------------------
-- Table-wide SELECT on public.models is revoked (20260724000002), so the two
-- columns added above are invisible to `authenticated` until they are named in
-- the grant. Same do-block, same exclusion list, plus the new columns.
do $$
declare
  col_list text;
  excluded_cols text[] := array[
    'instagram_marketing',
    'twitter_marketing',
    'proxy_ip',
    'proxy_company',
    'proxy_company_other',
    'proxy_country',
    'latest_note_summary'
  ];
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into col_list
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'models'
     and column_name <> all (excluded_cols);

  if col_list is null then
    raise exception 'models table introspection returned no columns — aborting to avoid locking out all reads';
  end if;

  execute 'revoke select on public.models from authenticated';
  execute format('grant select (%s) on public.models to authenticated', col_list);
end $$;

-- ----- model_earnings_reports: one publishable row per calendar month ---------
alter table public.model_earnings_reports
  add column if not exists period_month date,
  add column if not exists updated_by   uuid references public.profiles(id) on delete set null;

comment on column public.model_earnings_reports.period_month is
  'First day of the calendar month this report is the monthly figure for. NULL on legacy ad-hoc reports. gross_revenue is USD for these rows.';

alter table public.model_earnings_reports
  drop constraint if exists earnings_period_month_is_first_of_month;
alter table public.model_earnings_reports
  add constraint earnings_period_month_is_first_of_month
  check (period_month is null or date_trunc('month', period_month)::date = period_month);

create unique index if not exists model_earnings_period_month_key
  on public.model_earnings_reports (model_id, period_month)
  where period_month is not null;

create index if not exists model_earnings_published_period_idx
  on public.model_earnings_reports (model_id, period_month)
  where visible_to_model and period_month is not null;

-- ----- model_ledger_entries --------------------------------------------------
create table if not exists public.model_ledger_entries (
  id                    uuid primary key default gen_random_uuid(),
  model_id              uuid not null references public.models(id) on delete cascade,
  entry_type            public.ledger_entry_type not null,
  provider              public.ledger_provider,
  hotel_name            text,
  amount_brl            numeric(12,2) not null check (amount_brl > 0),
  -- When the cost happened. Record only: no effect on any month's earnings.
  incurred_on           date not null,
  -- When the agency takes it out of earnings. The month this date falls in is
  -- the month the deduction hits. NULL = pending, affects nothing.
  deduct_on             date,
  -- Snapshot, frozen once deduct_on is reached: BRL per 1 USD on that date,
  -- and the resulting USD amount. Historical months never move afterwards.
  deduction_fx_rate     numeric(18,8),
  deduction_amount_usd  numeric(12,2),
  deducted_at           timestamptz,
  created_by            uuid references public.profiles(id) on delete set null,
  updated_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  deleted_at            timestamptz,
  constraint provider_required_for_transporte
    check (entry_type <> 'transporte' or provider is not null),
  constraint hotel_name_required_for_hotel
    check (entry_type <> 'hotel' or (hotel_name is not null and length(btrim(hotel_name)) > 0)),
  constraint snapshot_is_complete
    check (num_nulls(deduction_fx_rate, deduction_amount_usd, deducted_at) in (0,3)),
  constraint snapshot_requires_deduct_on
    check (deducted_at is null or deduct_on is not null)
);

create index if not exists model_ledger_entries_deduct_idx
  on public.model_ledger_entries (model_id, deduct_on)
  where deleted_at is null;

create index if not exists model_ledger_entries_incurred_idx
  on public.model_ledger_entries (model_id, incurred_on)
  where deleted_at is null;

-- Drives the daily snapshot cron: due, still unsnapshotted, still live.
create index if not exists model_ledger_entries_pending_snapshot_idx
  on public.model_ledger_entries (deduct_on)
  where deleted_at is null and deduct_on is not null and deducted_at is null;

drop trigger if exists trg_model_ledger_entries_updated_at on public.model_ledger_entries;
create trigger trg_model_ledger_entries_updated_at before update on public.model_ledger_entries
  for each row execute function public.set_updated_at();

-- ----- fx_rates --------------------------------------------------------------
create table if not exists public.fx_rates (
  id              uuid primary key default gen_random_uuid(),
  base_currency   text not null,
  quote_currency  text not null,
  rate            numeric(18,8) not null check (rate > 0),
  rate_date       date not null,
  created_at      timestamptz not null default now(),
  unique (base_currency, quote_currency, rate_date)
);

create index if not exists fx_rates_pair_date_idx
  on public.fx_rates (base_currency, quote_currency, rate_date desc);

-- ----- model_notes: ledger-generated notes -----------------------------------
alter table public.model_notes
  add column if not exists source          text not null default 'manual',
  add column if not exists ledger_entry_id uuid references public.model_ledger_entries(id) on delete set null;

alter table public.model_notes
  drop constraint if exists model_notes_source_check;
alter table public.model_notes
  add constraint model_notes_source_check check (source in ('manual','ledger'));

create index if not exists model_notes_source_idx
  on public.model_notes (model_id, source)
  where archived = false;

create unique index if not exists model_notes_ledger_entry_key
  on public.model_notes (ledger_entry_id)
  where ledger_entry_id is not null;

-- ----- Role predicates -------------------------------------------------------
-- public.owns_model was declared in 20260722000002 but does not exist in the
-- live database; the policies below need it, so create it here with the same
-- semantics as private.is_own_model (own row AND the model is active).
create or replace function public.owns_model(target_model uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.models m
     where m.id = target_model
       and m.profile_id = auth.uid()
       and m.active = true
  )
$$;

-- The single source of truth for the Brazil-only ledger feature. Every read
-- path, write path and RLS policy asks this, never country_code.
create or replace function public.model_expenses_enabled(target_model uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select expenses_enabled from public.models where id = target_model),
    false
  )
$$;

revoke execute on function public.owns_model(uuid) from public;
revoke execute on function public.owns_model(uuid) from anon;
grant execute on function public.owns_model(uuid) to authenticated;

revoke execute on function public.model_expenses_enabled(uuid) from public;
revoke execute on function public.model_expenses_enabled(uuid) from anon;
grant execute on function public.model_expenses_enabled(uuid) to authenticated;

-- ----- RLS: model_ledger_entries ---------------------------------------------
alter table public.model_ledger_entries enable row level security;

-- Read: staff always (so a disabled model's history stays auditable), rep and
-- model only while the feature is on for that model — with expenses_enabled
-- false the rows are invisible to them at the database, not just in the UI.
drop policy if exists ledger_entries_select on public.model_ledger_entries;
create policy ledger_entries_select on public.model_ledger_entries
  for select to authenticated
  using (
    public.is_staff()
    or (
      public.model_expenses_enabled(model_id)
      and (
        public.is_assigned_representative(model_id)
        or public.owns_model(model_id)
      )
    )
  );

-- Write: owner/administrator only, and only while the feature is on. A rep or
-- a model gets nothing; an owner writing against a model with
-- expenses_enabled = false is denied here exactly as the route handler denies.
drop policy if exists ledger_entries_write on public.model_ledger_entries;
create policy ledger_entries_write on public.model_ledger_entries
  for all to authenticated
  using ( public.is_staff() and public.model_expenses_enabled(model_id) )
  with check ( public.is_staff() and public.model_expenses_enabled(model_id) );

grant select, insert, update on public.model_ledger_entries to authenticated;

-- ----- RLS: fx_rates ---------------------------------------------------------
-- The cache is written by the server with the service-role key only (rates are
-- never fetched from the client). Staff may read it for support purposes.
alter table public.fx_rates enable row level security;

drop policy if exists fx_rates_select on public.fx_rates;
create policy fx_rates_select on public.fx_rates
  for select to authenticated
  using ( public.is_staff() );

grant select on public.fx_rates to authenticated;

-- ----- RLS: model_notes — ledger notes are model-facing ----------------------
-- Manual notes stay internal (notes_select_staff_only, 20260731000000). This
-- adds a second, narrower SELECT policy: a model may read her own ledger notes
-- and an assigned rep may read hers, and nothing else. Policies are OR'd, so
-- source = 'manual' rows remain staff-only.
drop policy if exists notes_select_ledger on public.model_notes;
create policy notes_select_ledger on public.model_notes
  for select to authenticated
  using (
    source = 'ledger'
    and archived = false
    and public.model_expenses_enabled(model_id)
    and (
      public.is_assigned_representative(model_id)
      or public.owns_model(model_id)
    )
  );

-- ----- pt-BR formatting helpers (note bodies are written in SQL) -------------
-- ',' and '.' in a to_char numeric template are locale-independent literals
-- (unlike G / D), so this is deterministic regardless of the server's
-- lc_numeric: format US-style, then swap the two separators.
create or replace function public.format_ptbr_amount(v numeric)
returns text language sql immutable set search_path = public as $$
  select translate(to_char(coalesce(v, 0), 'FM999,999,999,990.00'), ',.', '.,')
$$;

create or replace function public.ledger_provider_label(p public.ledger_provider)
returns text language sql immutable set search_path = public as $$
  select case p
    when 'uber' then 'Uber'
    when '99' then '99'
    when 'indrive' then 'inDrive'
    else '—'
  end
$$;

create or replace function public.ledger_entry_note_text(entry public.model_ledger_entries)
returns text language sql stable set search_path = public as $$
  select case entry.entry_type
    when 'transporte' then
      'Transporte — ' || public.ledger_provider_label(entry.provider)
        || ' · R$ ' || public.format_ptbr_amount(entry.amount_brl)
        || ' · ocorrido em ' || to_char(entry.incurred_on, 'DD/MM/YYYY')
        || ' · ' || case
             when entry.deduct_on is null then 'desconto pendente'
             else 'desconto em ' || to_char(entry.deduct_on, 'DD/MM/YYYY')
           end
    when 'hotel' then
      'Hotel — ' || coalesce(btrim(entry.hotel_name), '—')
        || ' · R$ ' || public.format_ptbr_amount(entry.amount_brl)
        || ' · ocorrido em ' || to_char(entry.incurred_on, 'DD/MM/YYYY')
        || ' · ' || case
             when entry.deduct_on is null then 'desconto pendente'
             else 'desconto em ' || to_char(entry.deduct_on, 'DD/MM/YYYY')
           end
    else
      'Empréstimo — R$ ' || public.format_ptbr_amount(entry.amount_brl)
        || ' · ' || to_char(entry.incurred_on, 'DD/MM/YYYY')
        || ' · ' || case
             when entry.deduct_on is null then 'desconto pendente'
             else 'desconto em ' || to_char(entry.deduct_on, 'DD/MM/YYYY')
           end
  end
$$;

-- ----- Ledger write RPCs -----------------------------------------------------
-- Every write touches three tables (entry + model-facing note + admin audit
-- history) and they must not be able to drift apart, so each operation is one
-- SECURITY DEFINER function = one transaction. The functions self-check
-- is_staff() and model_expenses_enabled(), mirroring the route handlers.

create or replace function public.create_model_ledger_entry(
  p_model_id    uuid,
  p_entry_type  public.ledger_entry_type,
  p_provider    public.ledger_provider,
  p_hotel_name  text,
  p_amount_brl  numeric,
  p_incurred_on date,
  p_deduct_on   date
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_actor_id   uuid;
  v_actor_name text;
  v_actor_role public.app_role;
  v_entry      public.model_ledger_entries;
  v_note       text;
begin
  if not public.is_staff() then
    raise exception 'Somente owner ou administrador pode criar lançamentos.'
      using errcode = '42501';
  end if;

  if not public.model_expenses_enabled(p_model_id) then
    raise exception 'Lançamentos estão desativados para esta modelo.'
      using errcode = '42501';
  end if;

  select id, coalesce(full_name, 'Usuário'), role
    into v_actor_id, v_actor_name, v_actor_role
    from public.profiles where id = auth.uid();

  insert into public.model_ledger_entries (
    model_id, entry_type, provider, hotel_name, amount_brl,
    incurred_on, deduct_on, created_by, updated_by
  ) values (
    p_model_id,
    p_entry_type,
    case when p_entry_type = 'transporte' then p_provider end,
    case when p_entry_type = 'hotel' then btrim(p_hotel_name) end,
    p_amount_brl,
    p_incurred_on,
    p_deduct_on,
    v_actor_id,
    v_actor_id
  )
  returning * into v_entry;

  v_note := public.ledger_entry_note_text(v_entry);

  insert into public.model_notes (
    model_id, body, priority, source, ledger_entry_id,
    created_by, created_by_name, created_by_role,
    updated_by, updated_by_name, updated_by_role
  ) values (
    p_model_id, v_note, 'normal', 'ledger', v_entry.id,
    v_actor_id, v_actor_name, v_actor_role::text,
    v_actor_id, v_actor_name, v_actor_role::text
  );

  insert into public.model_audit_history (
    model_id, action, field_name, previous_value, new_value,
    actor_id, actor_name, actor_role, source, summary
  ) values (
    p_model_id, 'ledger_entry_created', 'ledger_entry', null, v_note,
    v_actor_id, v_actor_name, v_actor_role, 'rpc:create_model_ledger_entry',
    'Lançamento criado — ' || v_note
  );

  return v_entry.id;
end $$;

create or replace function public.update_model_ledger_entry(
  p_entry_id    uuid,
  p_provider    public.ledger_provider,
  p_hotel_name  text,
  p_amount_brl  numeric,
  p_incurred_on date,
  p_deduct_on   date
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor_id     uuid;
  v_actor_name   text;
  v_actor_role   public.app_role;
  v_before       public.model_ledger_entries;
  v_after        public.model_ledger_entries;
  v_before_note  text;
  v_after_note   text;
  v_resnapshot   boolean;
begin
  if not public.is_staff() then
    raise exception 'Somente owner ou administrador pode editar lançamentos.'
      using errcode = '42501';
  end if;

  select * into v_before
    from public.model_ledger_entries
   where id = p_entry_id and deleted_at is null;

  if v_before.id is null then
    raise exception 'Lançamento não encontrado.' using errcode = 'P0002';
  end if;

  if not public.model_expenses_enabled(v_before.model_id) then
    raise exception 'Lançamentos estão desativados para esta modelo.'
      using errcode = '42501';
  end if;

  select id, coalesce(full_name, 'Usuário'), role
    into v_actor_id, v_actor_name, v_actor_role
    from public.profiles where id = auth.uid();

  v_before_note := public.ledger_entry_note_text(v_before);

  -- A new deduction date invalidates any snapshot taken for the old one: it is
  -- cleared here and re-taken (by the cron or lazily on read) at the new date.
  v_resnapshot := v_before.deduct_on is distinct from p_deduct_on
                  and v_before.deducted_at is not null;

  update public.model_ledger_entries
     set provider    = case when entry_type = 'transporte' then p_provider end,
         hotel_name  = case when entry_type = 'hotel' then btrim(p_hotel_name) end,
         amount_brl  = p_amount_brl,
         incurred_on = p_incurred_on,
         deduct_on   = p_deduct_on,
         deduction_fx_rate    = case when v_resnapshot then null else deduction_fx_rate end,
         deduction_amount_usd = case when v_resnapshot then null else deduction_amount_usd end,
         deducted_at          = case when v_resnapshot then null else deducted_at end,
         updated_by  = v_actor_id
   where id = p_entry_id
  returning * into v_after;

  v_after_note := public.ledger_entry_note_text(v_after);

  update public.model_notes
     set body            = v_after_note,
         updated_by      = v_actor_id,
         updated_by_name = v_actor_name,
         updated_by_role = v_actor_role::text
   where ledger_entry_id = p_entry_id;

  insert into public.model_audit_history (
    model_id, action, field_name, previous_value, new_value,
    actor_id, actor_name, actor_role, source, summary
  ) values (
    v_after.model_id, 'ledger_entry_updated', 'ledger_entry', v_before_note, v_after_note,
    v_actor_id, v_actor_name, v_actor_role, 'rpc:update_model_ledger_entry',
    'Lançamento editado — ' || v_after_note
  );

  if v_before.deduct_on is distinct from p_deduct_on then
    insert into public.model_audit_history (
      model_id, action, field_name, previous_value, new_value,
      actor_id, actor_name, actor_role, source, summary
    ) values (
      v_after.model_id,
      'ledger_deduct_on_changed',
      'deduct_on',
      case when v_before.deduct_on is null then null else to_char(v_before.deduct_on, 'DD/MM/YYYY') end,
      case when p_deduct_on is null then null else to_char(p_deduct_on, 'DD/MM/YYYY') end,
      v_actor_id, v_actor_name, v_actor_role, 'rpc:update_model_ledger_entry',
      'Data de desconto alterada de '
        || coalesce(to_char(v_before.deduct_on, 'DD/MM/YYYY'), 'pendente')
        || ' para '
        || coalesce(to_char(p_deduct_on, 'DD/MM/YYYY'), 'pendente')
        || case when v_resnapshot then ' (câmbio recalculado na nova data)' else '' end
    );
  end if;
end $$;

create or replace function public.set_model_ledger_deduct_on(
  p_entry_id  uuid,
  p_deduct_on date
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_entry public.model_ledger_entries;
begin
  select * into v_entry
    from public.model_ledger_entries
   where id = p_entry_id and deleted_at is null;

  if v_entry.id is null then
    raise exception 'Lançamento não encontrado.' using errcode = 'P0002';
  end if;

  -- Permission and eligibility checks live in update_model_ledger_entry.
  perform public.update_model_ledger_entry(
    p_entry_id,
    v_entry.provider,
    v_entry.hotel_name,
    v_entry.amount_brl,
    v_entry.incurred_on,
    p_deduct_on
  );
end $$;

create or replace function public.delete_model_ledger_entry(p_entry_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_actor_id   uuid;
  v_actor_name text;
  v_actor_role public.app_role;
  v_entry      public.model_ledger_entries;
  v_note       text;
begin
  if not public.is_staff() then
    raise exception 'Somente owner ou administrador pode excluir lançamentos.'
      using errcode = '42501';
  end if;

  select * into v_entry
    from public.model_ledger_entries
   where id = p_entry_id and deleted_at is null;

  if v_entry.id is null then
    raise exception 'Lançamento não encontrado.' using errcode = 'P0002';
  end if;

  if not public.model_expenses_enabled(v_entry.model_id) then
    raise exception 'Lançamentos estão desativados para esta modelo.'
      using errcode = '42501';
  end if;

  select id, coalesce(full_name, 'Usuário'), role
    into v_actor_id, v_actor_name, v_actor_role
    from public.profiles where id = auth.uid();

  v_note := public.ledger_entry_note_text(v_entry);

  update public.model_ledger_entries
     set deleted_at = now(),
         updated_by = v_actor_id
   where id = p_entry_id;

  -- The entry and its audit trail survive; the note only leaves the
  -- model-facing view (archived rows are excluded by notes_select_ledger).
  update public.model_notes
     set archived        = true,
         updated_by      = v_actor_id,
         updated_by_name = v_actor_name,
         updated_by_role = v_actor_role::text
   where ledger_entry_id = p_entry_id;

  insert into public.model_audit_history (
    model_id, action, field_name, previous_value, new_value,
    actor_id, actor_name, actor_role, source, summary
  ) values (
    v_entry.model_id, 'ledger_entry_deleted', 'ledger_entry', v_note, null,
    v_actor_id, v_actor_name, v_actor_role, 'rpc:delete_model_ledger_entry',
    'Lançamento excluído — ' || v_note
  );
end $$;

-- Supabase's default privileges hand `anon` EXECUTE on every new function in
-- this schema, so anon has to be revoked by name (see 20260731000000).
revoke execute on function public.format_ptbr_amount(numeric) from public, anon;
revoke execute on function public.ledger_provider_label(public.ledger_provider) from public, anon;
revoke execute on function public.ledger_entry_note_text(public.model_ledger_entries) from public, anon;
revoke execute on function public.create_model_ledger_entry(uuid, public.ledger_entry_type, public.ledger_provider, text, numeric, date, date) from public, anon;
revoke execute on function public.update_model_ledger_entry(uuid, public.ledger_provider, text, numeric, date, date) from public, anon;
revoke execute on function public.set_model_ledger_deduct_on(uuid, date) from public, anon;
revoke execute on function public.delete_model_ledger_entry(uuid) from public, anon;

grant execute on function public.create_model_ledger_entry(uuid, public.ledger_entry_type, public.ledger_provider, text, numeric, date, date) to authenticated;
grant execute on function public.update_model_ledger_entry(uuid, public.ledger_provider, text, numeric, date, date) to authenticated;
grant execute on function public.set_model_ledger_deduct_on(uuid, date) to authenticated;
grant execute on function public.delete_model_ledger_entry(uuid) to authenticated;

-- =============================================================================
-- KARAY Models — Onboarding checklist: rep access, fill-in fields, automatic
-- percentages and an owner-only lock once onboarding is complete.
--
-- NOTE ON DRIFT (same caveat as 20260724000001 / 20260801000000): written
-- against the LIVE schema, where the role predicates are public.is_staff(),
-- public.is_owner(), public.is_assigned_representative(uuid) and
-- public.owns_model(uuid) — not against the older migration files.
--
-- What changes:
--   1. model_onboarding_items gains `field_values` (the fill-in boxes that do
--      not belong to any other table) and `updated_by`.
--   2. models.onboarding_percentage / onboarding_complete stop being written
--      by hand and become a trigger-maintained projection of the items. This
--      is what makes the percentage move on its own as boxes are ticked.
--   3. Representatives may read AND write the onboarding of the models
--      assigned to them — they could previously only read.
--   4. Once onboarding_complete is true, only the owner may touch the
--      checklist. Enforced by a trigger, so it holds for PostgREST and for
--      the route handlers alike.
--   5. set_onboarding_linked_field() writes the checklist fields that live in
--      other tables (models / model_payments) from a fixed allowlist, so a
--      rep can fill them in without being granted UPDATE on those tables.
-- =============================================================================

-- ----- 1. Fill-in boxes ------------------------------------------------------
alter table public.model_onboarding_items
  add column if not exists field_values jsonb not null default '{}'::jsonb,
  add column if not exists updated_by   uuid references public.profiles(id) on delete set null;

comment on column public.model_onboarding_items.field_values is
  'Fill-in boxes whose value belongs to this step alone. Fields that mirror a column elsewhere (models, model_payments) are NOT stored here — see public.set_onboarding_linked_field.';

alter table public.model_onboarding_items
  drop constraint if exists onboarding_field_values_is_object;
alter table public.model_onboarding_items
  add constraint onboarding_field_values_is_object
  check (jsonb_typeof(field_values) = 'object');

-- ----- 1b. completed_at, which the live database never got -------------------
-- 20260722000001 declared sync_onboarding_completed_at() and its trigger, but
-- neither reached the live database (introspection: the only trigger on the
-- table is set_model_onboarding_updated_at). Without it `completed_at` stays
-- null forever and the "Concluída em …" line can never render. Recreated here
-- rather than by editing the old migration, so an already-migrated database
-- and a fresh one end up in the same place.
create or replace function public.sync_onboarding_completed_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.completed and (old.completed is distinct from true) then
    new.completed_at = now();
  elsif not new.completed then
    new.completed_at = null;
    new.completed_by = null;
  end if;
  return new;
end $$;

drop trigger if exists trg_onboarding_completed_at on public.model_onboarding_items;
create trigger trg_onboarding_completed_at
  before update on public.model_onboarding_items
  for each row execute function public.sync_onboarding_completed_at();

-- ----- 2. Percentage is derived, never typed in ------------------------------
-- Recomputed from the items on every insert/update/delete, across all
-- platforms for the model, so "100%" always means "every seeded step done".
create or replace function public.sync_model_onboarding_progress()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target      uuid;
  total_items integer;
  done_items  integer;
  pct         integer;
  is_done     boolean;
begin
  -- NEW is unassigned in a DELETE trigger and OLD in an INSERT trigger, so
  -- neither can be read unconditionally.
  if tg_op = 'DELETE' then
    target := old.model_id;
  else
    target := new.model_id;
  end if;

  select count(*), count(*) filter (where completed)
    into total_items, done_items
    from public.model_onboarding_items
   where model_id = target;

  pct := case
           when total_items = 0 then 0
           else round((done_items::numeric / total_items) * 100)
         end;

  is_done := total_items > 0 and done_items = total_items;

  update public.models
     set onboarding_percentage = pct,
         onboarding_complete   = is_done
   where id = target
     and (onboarding_percentage is distinct from pct
          or onboarding_complete is distinct from is_done);

  return null;
end $$;

drop trigger if exists trg_onboarding_progress on public.model_onboarding_items;
create trigger trg_onboarding_progress
  after insert or update or delete on public.model_onboarding_items
  for each row execute function public.sync_model_onboarding_progress();

-- ----- 3. Owner-only once complete -------------------------------------------
-- Reads the model's CURRENT completion state, i.e. the state before this
-- statement lands. A rep ticking the last open box is therefore allowed (the
-- onboarding is not complete yet at that moment) and is locked out from the
-- next write onwards. Unticking a box as the owner drops the percentage below
-- 100, which lifts the lock again — that is the intended escape hatch.
create or replace function public.guard_onboarding_lock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  locked boolean;
begin
  if tg_op = 'DELETE' then
    target := old.model_id;
  else
    target := new.model_id;
  end if;

  select onboarding_complete
    into locked
    from public.models
   where id = target;

  if coalesce(locked, false)
     and not public.is_owner()
     -- Seeding a step that did not exist when this model finished is a change
     -- to the process, not to her recorded progress: staff may still do it,
     -- and the new step simply drops her below 100% until it is done. Editing
     -- what is already there stays owner-only.
     and not (tg_op = 'INSERT' and public.is_staff())
  then
    raise exception 'Onboarding concluído: apenas o proprietário pode alterá-lo.'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end $$;

drop trigger if exists trg_onboarding_lock on public.model_onboarding_items;
create trigger trg_onboarding_lock
  before insert or update or delete on public.model_onboarding_items
  for each row execute function public.guard_onboarding_lock();

-- ----- 4. RLS: representatives may now write their own models' onboarding ----
alter table public.model_onboarding_items enable row level security;

drop policy if exists onboarding_select on public.model_onboarding_items;
create policy onboarding_select on public.model_onboarding_items
  for select to authenticated
  using (
    public.is_staff()
    or public.is_assigned_representative(model_id)
    or public.owns_model(model_id)
  );

-- The old catch-all `for all` policy was staff-only; replaced by per-command
-- policies so a rep gains insert/update without gaining delete.
drop policy if exists onboarding_write on public.model_onboarding_items;

drop policy if exists onboarding_insert on public.model_onboarding_items;
create policy onboarding_insert on public.model_onboarding_items
  for insert to authenticated
  with check (
    public.is_staff()
    or public.is_assigned_representative(model_id)
  );

drop policy if exists onboarding_update on public.model_onboarding_items;
create policy onboarding_update on public.model_onboarding_items
  for update to authenticated
  using (
    public.is_staff()
    or public.is_assigned_representative(model_id)
  )
  with check (
    public.is_staff()
    or public.is_assigned_representative(model_id)
  );

-- Removing a step is a change to the process itself, not to a model's
-- progress — owner only, regardless of the lock.
drop policy if exists onboarding_delete on public.model_onboarding_items;
create policy onboarding_delete on public.model_onboarding_items
  for delete to authenticated
  using ( public.is_owner() );

grant select, insert, update, delete on public.model_onboarding_items to authenticated;

-- anon holds a full set of table grants here purely from Supabase's default
-- privileges. RLS denies it every row regardless (there is no policy granting
-- anon anything), but an unauthenticated role has no business holding write
-- privileges on a model's onboarding — drop them rather than relying on RLS
-- alone to be the only thing standing in the way.
revoke all on public.model_onboarding_items from anon;

-- ----- 5. Checklist fields that live in other tables -------------------------
-- A rep must be able to fill in "Chave PIX" or "Perfil OnlyFans" from the
-- checklist, but must NOT get UPDATE on public.models or public.model_payments
-- (which would also let them change status, percentages or the revenue split).
-- This SECURITY DEFINER function is the whole of what the checklist may write:
-- one fixed allowlist, one column per call.
--
-- The allowlist mirrors LINKED_FIELDS in lib/onboarding/definition.ts. The two
-- are deliberately independent — a key the UI offers but this function does
-- not know is rejected here, not silently written.
create or replace function public.set_onboarding_linked_field(
  target_model uuid,
  field_key    text,
  new_value    text
)
returns void
language plpgsql security definer set search_path = public as $$
declare
  model_columns text[] := array[
    'stage_name', 'birthday', 'email', 'whatsapp', 'nationality', 'city',
    'language', 'country_code', 'preferred_currency', 'content_frequency',
    'referral_source', 'onlyfans', 'fansly', 'instagram', 'twitter', 'reddit',
    'tiktok', 'youtube', 'facebook', 'drive_onlyfans', 'drive_instagram',
    'drive_twitter', 'content_drive_url'
  ];
  -- The columns public.model_payments actually has. The names in
  -- 20260722000001_initial_schema.sql (pix_type, bank_agency, bank_account,
  -- account_holder_cpf, payment_frequency) do not exist on the live table.
  payment_columns text[] := array[
    'pix_key', 'pix_key_type', 'bank_name', 'account_holder_name',
    'payout_frequency'
  ];
  cleaned      text := nullif(btrim(coalesce(new_value, '')), '');
  locked       boolean;
  column_type  text;
  updated_rows integer;
begin
  if not (
    public.is_staff()
    or public.is_assigned_representative(target_model)
  ) then
    raise exception 'Sem permissão para editar o onboarding desta modelo.'
      using errcode = '42501';
  end if;

  select onboarding_complete
    into locked
    from public.models
   where id = target_model;

  if not found then
    raise exception 'Modelo não encontrada.' using errcode = 'P0002';
  end if;

  if coalesce(locked, false) and not public.is_owner() then
    raise exception 'Onboarding concluído: apenas o proprietário pode alterá-lo.'
      using errcode = '42501';
  end if;

  if field_key = any (model_columns) then
    -- The column name is one of the literals above, so format(%I) here is
    -- interpolating a value this function chose, not caller input. The cast
    -- makes the text parameter land in date / boolean / numeric columns too.
    select format_type(atttypid, atttypmod)
      into column_type
      from pg_attribute
     where attrelid = 'public.models'::regclass
       and attname = field_key
       and attnum > 0
       and not attisdropped;

    -- A name in the allowlist that the table does not actually have would
    -- otherwise build 'cast($1 as )' and fail with a syntax error. Say what
    -- is really wrong instead.
    if column_type is null then
      raise exception 'Coluna de onboarding ausente em models: %', field_key
        using errcode = '42703';
    end if;

    execute format(
      'update public.models set %I = cast($1 as %s) where id = $2',
      field_key, column_type
    ) using cleaned, target_model;

  elsif field_key = any (payment_columns) then
    select format_type(atttypid, atttypmod)
      into column_type
      from pg_attribute
     where attrelid = 'public.model_payments'::regclass
       and attname = field_key
       and attnum > 0
       and not attisdropped;

    if column_type is null then
      raise exception 'Coluna de onboarding ausente em model_payments: %', field_key
        using errcode = '42703';
    end if;

    -- model_payments has no unique constraint on model_id, so this is an
    -- update-then-insert rather than an upsert. FOUND is deliberately not
    -- consulted: PL/pgSQL does not update it after EXECUTE, so it would still
    -- hold the result of the SELECT above and the insert would never run.
    execute format(
      'update public.model_payments set %I = cast($1 as %s) where model_id = $2',
      field_key, column_type
    ) using cleaned, target_model;

    get diagnostics updated_rows = row_count;

    if updated_rows = 0 then
      execute format(
        'insert into public.model_payments (model_id, %I) values ($1, cast($2 as %s))',
        field_key, column_type
      ) using target_model, cleaned;
    end if;

  else
    raise exception 'Campo de onboarding desconhecido: %', field_key
      using errcode = '22023';
  end if;
end $$;

revoke execute on function public.set_onboarding_linked_field(uuid, text, text) from public;
revoke execute on function public.set_onboarding_linked_field(uuid, text, text) from anon;
grant execute on function public.set_onboarding_linked_field(uuid, text, text) to authenticated;

-- The two triggers above are called by the table, never directly; anon and
-- authenticated have no reason to hold EXECUTE on them (Supabase security
-- advisor: authenticated_security_definer_function_executable).
revoke execute on function public.sync_model_onboarding_progress() from public;
revoke execute on function public.sync_model_onboarding_progress() from anon;
revoke execute on function public.sync_model_onboarding_progress() from authenticated;
revoke execute on function public.guard_onboarding_lock() from public;
revoke execute on function public.guard_onboarding_lock() from anon;
revoke execute on function public.guard_onboarding_lock() from authenticated;
revoke execute on function public.sync_onboarding_completed_at() from public;
revoke execute on function public.sync_onboarding_completed_at() from anon;
revoke execute on function public.sync_onboarding_completed_at() from authenticated;

-- ----- 6. Audit: a rep's onboarding edits have to be recorded too -------------
-- audit_history_insert was staff-only (20260730000000) because only staff could
-- change anything worth auditing. Representatives now edit the onboarding of
-- the models assigned to them, and an unauditable edit is worse than no edit:
-- logAuditEntry would fail RLS and the change would land unrecorded. Reps can
-- already READ the history of their own models, so this grants no new visibility.
drop policy if exists audit_history_insert on public.model_audit_history;
create policy audit_history_insert on public.model_audit_history
  for insert to authenticated
  with check (
    public.is_staff()
    or public.is_assigned_representative(model_id)
  );

-- ----- 7. Reconcile the models already in the database ------------------------
-- models.onboarding_percentage was previously written by /api/models/checklist
-- from the model_checklist statuses. It is now derived from the items, so any
-- model that has no items yet must read 0 rather than keep a stale number that
-- nothing will ever move again. Models with items are recomputed in place.
update public.models m
   set onboarding_percentage = coalesce(computed.pct, 0),
       onboarding_complete   = coalesce(computed.is_done, false)
  from (
    select
      candidates.id,
      case
        when counts.total = 0 then 0
        else round((counts.done::numeric / counts.total) * 100)
      end as pct,
      counts.total > 0 and counts.done = counts.total as is_done
    from public.models candidates
    cross join lateral (
      select
        count(*)                            as total,
        count(*) filter (where completed)   as done
      from public.model_onboarding_items i
      where i.model_id = candidates.id
    ) counts
  ) computed
 where m.id = computed.id
   and (m.onboarding_percentage is distinct from computed.pct
        or m.onboarding_complete is distinct from computed.is_done);

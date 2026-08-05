-- =============================================================================
-- KARAY Models — remove the "Pós-embarque" workflow.
--
-- A Post Boarding tab was built on a side branch
-- (devin/1785901020-post-boarding-refinement) and reached the live database,
-- but never reached main: the branch's code is not part of this codebase, so
-- there is nothing to delete in TypeScript. What it left behind is entirely in
-- the database, and this migration takes it back out.
--
-- What it left, and what happens to it here:
--
--   1. public.model_post_boarding_notes — the tab's own table. Dropped, with
--      its indexes, trigger and policies.
--   2. Copies of those notes in public.model_notes under source =
--      'post_boarding' (the "Migrado do onboarding." entries). Deleted; their
--      rows in model_note_history go with them through the existing cascade.
--   3. A widened model_notes_source_check. Put back to ('manual','ledger') —
--      20260805040000 is what adds 'daily' on top of it.
--   4. A replaced notes_update policy that had dropped the `deleted_at is
--      null` condition, so a representative could edit a note that had been
--      soft-deleted. Restored to the 20260804000000 definition.
--   5. A widened set_onboarding_linked_field allowlist (it had gained the two
--      marketing columns). Restored verbatim to the 20260803000000 definition,
--      which is the one this codebase's LINKED_FIELDS mirrors.
--
-- Nine onboarding steps were also deleted from model_onboarding_items by that
-- migration. The steps themselves need no rescue — syncOnboardingItems()
-- re-seeds any canonical step a model is missing on the next read of her
-- Status tab. Whether a step was already TICKED is the part re-seeding cannot
-- know, so step 1 below reads that back out of the Post Boarding notes before
-- they are deleted.
-- =============================================================================

-- ----- 1. Give the moved steps their tick back -------------------------------
-- That migration wrote "Migrado do onboarding — concluído em … por …" for
-- every step it moved that was already done. A model whose onboarding was
-- complete kept her rows (the lock trigger refused the delete), so this only
-- has work to do for the rest — hence the `not exists` guard, which also makes
-- the whole statement safe to run twice.
--
-- The ordering metadata is copied from any other model's row for the same
-- step, because those columns are NOT NULL and this migration has no business
-- knowing the checklist's shape. If no model anywhere still has the step, the
-- row is left for syncOnboardingItems() to seed unticked — better a lost tick
-- than an invented one.
insert into public.model_onboarding_items (
  model_id, platform, item_key, section_key, section_title, section_order,
  item_title, item_description, item_order, responsibility,
  completed, completed_at
)
select distinct on (note.model_id, note.item_key)
  note.model_id,
  'onlyfans',
  note.item_key,
  note.section_key,
  template.section_title,
  template.section_order,
  coalesce(note.item_title, template.item_title),
  coalesce(note.item_description, template.item_description),
  template.item_order,
  template.responsibility,
  true,
  note.created_at
from public.model_post_boarding_notes note
join lateral (
  select section_title, section_order, item_title, item_description,
         item_order, responsibility
    from public.model_onboarding_items
   where item_key = note.item_key
     and platform = 'onlyfans'
   limit 1
) template on true
where note.body like 'Migrado do onboarding — concluído%'
  and not exists (
    select 1
      from public.model_onboarding_items existing
     where existing.model_id = note.model_id
       and existing.platform = 'onlyfans'
       and existing.item_key = note.item_key
  );

-- ----- 2. The tab's table ----------------------------------------------------
drop table if exists public.model_post_boarding_notes cascade;

-- ----- 3. Its copies in the Notes tab ----------------------------------------
delete from public.model_notes where source = 'post_boarding';

-- ----- 4. The source allowlist -----------------------------------------------
alter table public.model_notes
  drop constraint if exists model_notes_source_check;
alter table public.model_notes
  add constraint model_notes_source_check check (source in ('manual', 'ledger'));

-- ----- 5. The note-update policy ---------------------------------------------
-- Verbatim from 20260804000000_representative_notes.sql. The condition that
-- matters is `deleted_at is null`: a soft-deleted note is not hers to edit.
drop policy if exists notes_update on public.model_notes;
create policy notes_update on public.model_notes
  for update to authenticated
  using (
    public.is_staff()
    or (
      created_by = auth.uid()
      and public.is_assigned_representative(model_id)
      and deleted_at is null
    )
  )
  with check (
    public.is_staff()
    or (
      created_by = auth.uid()
      and public.is_assigned_representative(model_id)
      and deleted_at is null
    )
  );

-- ----- 6. The onboarding field allowlist -------------------------------------
-- Verbatim from 20260803000000_onboarding_checklist_rework.sql. The marketing
-- columns are staff-only and the checklist has no business writing them.
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

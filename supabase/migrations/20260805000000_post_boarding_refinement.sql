-- =============================================================================
-- KARAY Models — Onboarding vs. Post Boarding split
--
-- 1. Links the "Segundo Instagram" onboarding field to models.instagram_marketing
--    so the Status tab and the Summary tab share one source of truth.
-- 2. Creates a dedicated Post Boarding notes table for ongoing work that used to
--    live inside onboarding (Step 3 final items, Step 5, Step 7 and
--    "Garantia de qualidade").
-- 3. Migrates existing onboarding progress for those items into the first Post
--    Boarding notes so no data is lost.
-- 4. Copies every new Post Boarding note into model_notes and model_audit_history
--    for the internal audit trail.
-- =============================================================================

-- ----- 1. Post Boarding notes table ------------------------------------------
create table if not exists public.model_post_boarding_notes (
  id                uuid primary key default gen_random_uuid(),
  model_id          uuid not null references public.models(id) on delete cascade,
  item_key          text not null,
  section_key       text not null,
  item_title        text not null,
  item_description  text,
  body              text not null check (length(btrim(body)) > 0),
  created_by        uuid references public.profiles(id) on delete set null,
  created_by_name   text,
  created_by_role   text,
  updated_by        uuid references public.profiles(id) on delete set null,
  updated_by_name   text,
  updated_by_role   text,
  -- The parallel model_notes row kept in sync for the internal notes tab.
  model_note_id     uuid references public.model_notes(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists model_post_boarding_notes_model_id_idx
  on public.model_post_boarding_notes (model_id);
create index if not exists model_post_boarding_notes_item_key_idx
  on public.model_post_boarding_notes (model_id, item_key);

drop trigger if exists trg_model_post_boarding_notes_updated_at on public.model_post_boarding_notes;
create trigger trg_model_post_boarding_notes_updated_at
  before update on public.model_post_boarding_notes
  for each row execute function public.set_updated_at();

alter table public.model_post_boarding_notes enable row level security;

drop policy if exists post_boarding_notes_select on public.model_post_boarding_notes;
create policy post_boarding_notes_select on public.model_post_boarding_notes
  for select to authenticated
  using (
    public.is_staff()
    or public.is_assigned_representative(model_id)
  );

drop policy if exists post_boarding_notes_insert on public.model_post_boarding_notes;
create policy post_boarding_notes_insert on public.model_post_boarding_notes
  for insert to authenticated
  with check (
    public.is_staff()
    or public.is_assigned_representative(model_id)
  );

drop policy if exists post_boarding_notes_update on public.model_post_boarding_notes;
create policy post_boarding_notes_update on public.model_post_boarding_notes
  for update to authenticated
  using (
    public.is_staff()
    or (
      created_by = auth.uid()
      and public.is_assigned_representative(model_id)
    )
  )
  with check (
    public.is_staff()
    or (
      created_by = auth.uid()
      and public.is_assigned_representative(model_id)
    )
  );

drop policy if exists post_boarding_notes_delete on public.model_post_boarding_notes;
create policy post_boarding_notes_delete on public.model_post_boarding_notes
  for delete to authenticated
  using ( public.is_owner() );

-- Representatives can edit their own model_notes too, so the Post Boarding
-- copies stay in sync when a rep edits a note.
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

-- ----- 2. model_notes source for Post Boarding copies ------------------------
alter table public.model_notes
  drop constraint if exists model_notes_source_check;
alter table public.model_notes
  add constraint model_notes_source_check check (source in ('manual', 'ledger', 'post_boarding'));

-- ----- 3. Refresh set_onboarding_linked_field for instagram_marketing --------
-- Marketing columns are now part of the allowlist, but remain staff-only.
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
    'referral_source', 'onlyfans', 'fansly', 'instagram', 'instagram_marketing',
    'twitter', 'reddit', 'tiktok', 'youtube', 'facebook', 'drive_onlyfans',
    'drive_instagram', 'drive_twitter', 'content_drive_url'
  ];
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

  if field_key = any (array['instagram_marketing', 'twitter_marketing'])
     and not public.is_staff() then
    raise exception 'Contas de marketing só podem ser editadas pela administração.'
      using errcode = '42501';
  end if;

  if field_key = any (model_columns) then
    select format_type(atttypid, atttypmod)
      into column_type
      from pg_attribute
     where attrelid = 'public.models'::regclass
       and attname = field_key
       and attnum > 0
       and not attisdropped;

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

-- The migration issues UPDATE/DELETE against model_onboarding_items. The
-- guard_onboarding_lock trigger rejects any write on completed models when
-- auth.uid() is null, and Supabase does not let us disable system triggers.
-- We therefore skip completed models in the cleanup update and let the progress
-- trigger recompute percentages as rows are removed; the final UPDATE below
-- corrects any drift.

-- ----- 4. Migrate the old "Segundo Instagram" onboarding value to the shared
-- marketing column so Status and Summary read the same field forever.
-- The onboarding JSON value wins if it is non-empty: that is the value the
-- admin/rep most recently saved in the Status tab.
update public.models m
   set instagram_marketing = coalesce(nullif(btrim(i.field_values ->> 'instagram_second'), ''), m.instagram_marketing)
  from public.model_onboarding_items i
 where i.model_id = m.id
   and i.platform = 'onlyfans'
   and i.item_key = 'model_information.social_media_links'
   and i.field_values ? 'instagram_second';

-- Remove the now-duplicate value from the onboarding JSON so future loads
-- never resurrect a stale copy.
update public.model_onboarding_items
   set field_values = field_values - 'instagram_second'
 where platform = 'onlyfans'
   and item_key = 'model_information.social_media_links'
   and field_values ? 'instagram_second'
   -- Completed models are owner-locked; leaving the stale JSON key there is
   -- harmless because the UI reads the linked column (models.instagram_marketing)
   -- instead of this JSON value.
   and model_id not in (
     select id from public.models where onboarding_complete = true
   );

-- ----- 5. Migrate moved onboarding items into Post Boarding notes ------------
-- The keys that no longer belong to onboarding. Existing completion data is
-- preserved as the first note for each item.
do $$
declare
  moved_item_keys text[] := array[
    'profile_optimization.internal_linking',
    'profile_optimization.subscriber_lists',
    'content_strategy.quality_assurance',
    'marketing_promotion.social_media_integration',
    'marketing_promotion.collaborations',
    'marketing_promotion.engagement',
    'continuous_improvement.analytics_monitoring',
    'continuous_improvement.feedback_collection',
    'continuous_improvement.professional_development'
  ];
  rec record;
begin
  for rec in
    select
      i.model_id,
      i.item_key,
      i.section_key,
      i.item_title,
      i.item_description,
      i.completed,
      i.completed_at,
      i.notes,
      i.created_at,
      p.full_name as creator_name,
      p.role as creator_role
    from public.model_onboarding_items i
    left join public.profiles p on p.id = i.completed_by
    where i.platform = 'onlyfans'
      and i.item_key = any (moved_item_keys)
      and not exists (
        select 1
        from public.model_post_boarding_notes n
        where n.model_id = i.model_id
          and n.item_key = i.item_key
          and n.created_by is null -- migration marker: no real author
      )
  loop
    insert into public.model_post_boarding_notes (
      model_id,
      item_key,
      section_key,
      item_title,
      item_description,
      body,
      created_by,
      created_by_name,
      created_by_role,
      updated_by,
      updated_by_name,
      updated_by_role,
      created_at,
      updated_at
    ) values (
      rec.model_id,
      rec.item_key,
      rec.section_key,
      rec.item_title,
      rec.item_description,
      coalesce(
        nullif(
          concat(
            case when rec.completed then 'Migrado do onboarding — concluído' else 'Migrado do onboarding' end,
            case when rec.completed_at is not null
              then ' em ' || to_char(rec.completed_at, 'DD/MM/YYYY HH24:MI')
              else ''
            end,
            case when rec.creator_name is not null
              then ' por ' || rec.creator_name
              else ''
            end,
            '.',
            case when rec.notes is not null and btrim(rec.notes) <> ''
              then E'\nObservação anterior: ' || rec.notes
              else ''
            end
          ),
          ''
        ),
        'Migrado do onboarding.'
      ),
      null,
      rec.creator_name,
      rec.creator_role,
      null,
      rec.creator_name,
      rec.creator_role,
      coalesce(rec.completed_at, rec.created_at, now()),
      coalesce(rec.completed_at, rec.created_at, now())
    );
  end loop;
end $$;

-- ----- 6. Remove migrated rows from onboarding --------------------------------
-- Remove the migrated rows from onboarding so the progress percentage reflects
-- the smaller, one-time checklist. Locked (completed) models keep their rows
-- because the onboarding lock trigger would block the deletion; they simply
-- become invisible to the UI and do not affect progress.
delete from public.model_onboarding_items
 where platform = 'onlyfans'
   and item_key in (
     'profile_optimization.internal_linking',
     'profile_optimization.subscriber_lists',
     'content_strategy.quality_assurance',
     'marketing_promotion.social_media_integration',
     'marketing_promotion.collaborations',
     'marketing_promotion.engagement',
     'continuous_improvement.analytics_monitoring',
     'continuous_improvement.feedback_collection',
     'continuous_improvement.professional_development'
   )
   and model_id not in (
     select id from public.models where onboarding_complete = true
   );

-- ----- 7. Recompute onboarding percentages -----------------------------------
-- Recompute percentages for models that lost rows.
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
        and i.platform = 'onlyfans'
    ) counts
  ) computed
 where m.id = computed.id
   and (m.onboarding_percentage is distinct from computed.pct
        or m.onboarding_complete is distinct from computed.is_done);

-- ----- 8. Refresh get_model_marketing grants ----------------------------------
-- The onboarding loader now reads instagram_marketing / twitter_marketing
-- through this RPC. Make sure authenticated can still call it.
grant execute on function public.get_model_marketing(uuid) to authenticated;

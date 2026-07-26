-- Synchronize OnlyFans model visibility with the Amplia canonical identity.
--
-- Root cause being fixed:
--  1. The Amplia client list was querying `models.talent_id`, a column that is
--     both optional and subject to the `models` column-allowlist RLS. When a
--     model did not yet have a linked `talents` row, or when the column grant
--     had not been refreshed, the query failed silently and returned an
--     empty list.
--  2. New models created after the Amplia migration did not get a `talents`
--     record or an `onlyfans` service enrollment, so they never appeared in
--     the regular social-media / brand-models area.
--  3. Deactivating/reactivating a model only toggled `models.active`, leaving
--     the `service_enrollments` status out of sync.
--
-- This migration:
--  - backfills a `talents` row for every `models` row that is missing one,
--  - links the two tables via `models.talent_id` when possible,
--  - creates missing `onlyfans` service enrollments with status driven by
--    `models.active`,
--  - installs a trigger that keeps the OnlyFans enrollment and `talents.active`
--    in sync whenever `models.active` changes,
--  - creates missing `brand_growth` service enrollments for existing brand
--    profiles so the regular models area can show them too.

-- ---------------------------------------------------------------------------
-- Service types
-- ---------------------------------------------------------------------------
insert into public.service_types (code, name, description, active)
values
  ('onlyfans', 'OnlyFans', 'OnlyFans talent management', true),
  ('brand_growth', 'Brand Growth', 'Amplia brand growth and social media management', true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  active = excluded.active;

-- ---------------------------------------------------------------------------
-- Backfill: link existing profile-only talents to their model before creating
-- new talent rows, to avoid unique-constraint collisions on profile_id.
-- ---------------------------------------------------------------------------
update public.talents t
set
  model_id = m.id,
  display_name = coalesce(m.display_name, t.display_name),
  stage_name = coalesce(m.stage_name, t.stage_name),
  email = coalesce(m.email, t.email),
  whatsapp = coalesce(m.whatsapp, t.whatsapp),
  birthday = coalesce(m.birthday, t.birthday),
  nationality = coalesce(m.nationality, t.nationality),
  location = coalesce(m.city, t.location),
  languages = case
    when m.language is not null then array[m.language]
    else t.languages
  end,
  active = true,
  updated_at = now()
from public.models m
where m.profile_id = t.profile_id
  and m.profile_id is not null
  and t.model_id is null;

-- ---------------------------------------------------------------------------
-- Backfill: create a talent row for every model that still lacks one.
-- ---------------------------------------------------------------------------
insert into public.talents (
  profile_id,
  model_id,
  legal_name,
  stage_name,
  display_name,
  email,
  whatsapp,
  birthday,
  nationality,
  location,
  languages,
  active
)
select
  m.profile_id,
  m.id,
  coalesce(p.full_name, m.display_name),
  m.stage_name,
  m.display_name,
  m.email,
  m.whatsapp,
  m.birthday,
  m.nationality,
  m.city,
  case when m.language is not null then array[m.language] else null end,
  true
from public.models m
left join public.profiles p on p.id = m.profile_id
where not exists (
  select 1 from public.talents t where t.model_id = m.id
);

-- ---------------------------------------------------------------------------
-- Backfill: set models.talent_id where it is missing or stale.
-- ---------------------------------------------------------------------------
update public.models m
set talent_id = t.id
from public.talents t
where t.model_id = m.id
  and m.talent_id is distinct from t.id;

-- ---------------------------------------------------------------------------
-- Backfill: create onlyfans service enrollments for model-linked talents.
-- ---------------------------------------------------------------------------
insert into public.service_enrollments (
  talent_id,
  service_type_id,
  status,
  started_at
)
select
  t.id,
  st.id,
  case when m.active then 'active' else 'inactive' end,
  case when m.active then now() else null end
from public.talents t
join public.models m on m.id = t.model_id
join public.service_types st on st.code = 'onlyfans'
where not exists (
  select 1
  from public.service_enrollments se
  where se.talent_id = t.id
    and se.service_type_id = st.id
)
on conflict (talent_id, service_type_id) do nothing;

-- ---------------------------------------------------------------------------
-- Backfill: create brand_growth service enrollments for existing brand profiles.
-- ---------------------------------------------------------------------------
insert into public.service_enrollments (
  talent_id,
  service_type_id,
  status,
  started_at
)
select
  bp.talent_id,
  st.id,
  'active',
  now()
from public.brand_profiles bp
join public.service_types st on st.code = 'brand_growth'
where not exists (
  select 1
  from public.service_enrollments se
  where se.talent_id = bp.talent_id
    and se.service_type_id = st.id
)
on conflict (talent_id, service_type_id) do nothing;

-- ---------------------------------------------------------------------------
-- Trigger: keep onlyfans enrollment and talent active flag in sync with the
-- operational models.active toggle.
-- ---------------------------------------------------------------------------
create or replace function public.sync_model_onlyfans_enrollment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
decl
  v_talent_id uuid;
  v_service_type_id uuid;
  v_new_status text;
  v_any_active boolean;
begin
  -- Find the canonical talent for this model.
  select t.id into v_talent_id
  from public.talents t
  where t.model_id = new.id;

  if v_talent_id is null then
    return new;
  end if;

  -- Resolve the onlyfans service type.
  select id into v_service_type_id
  from public.service_types
  where code = 'onlyfans';

  if v_service_type_id is null then
    return new;
  end if;

  v_new_status := case when new.active then 'active' else 'inactive' end;

  -- Upsert the onlyfans enrollment so its status matches models.active.
  insert into public.service_enrollments (
    talent_id,
    service_type_id,
    status,
    started_at,
    ended_at,
    updated_at
  )
  values (
    v_talent_id,
    v_service_type_id,
    v_new_status,
    case when new.active then now() else null end,
    case when new.active then null else now() end,
    now()
  )
  on conflict (talent_id, service_type_id) do update set
    status = excluded.status,
    started_at = case
      when excluded.status = 'active' and service_enrollments.started_at is null then now()
      when excluded.status = 'inactive' then service_enrollments.started_at
      else service_enrollments.started_at
    end,
    ended_at = excluded.ended_at,
    updated_at = now();

  -- Keep talents.active consistent with the presence of any active enrollment.
  select exists (
    select 1
    from public.service_enrollments se
    where se.talent_id = v_talent_id
      and se.status = 'active'
  ) into v_any_active;

  update public.talents
  set
    active = v_any_active,
    updated_at = now()
  where id = v_talent_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_model_onlyfans_enrollment on public.models;
create trigger trg_sync_model_onlyfans_enrollment
after update of active, status on public.models
for each row
execute function public.sync_model_onlyfans_enrollment();

-- Rollback notes (apply manually if needed):
--   drop trigger if exists trg_sync_model_onlyfans_enrollment on public.models;
--   drop function if exists public.sync_model_onlyfans_enrollment();
--   delete from public.service_enrollments where service_type_id in (
--     select id from public.service_types where code in ('onlyfans', 'brand_growth')
--   );
--   update public.models set talent_id = null;
--   delete from public.talents where model_id is not null;

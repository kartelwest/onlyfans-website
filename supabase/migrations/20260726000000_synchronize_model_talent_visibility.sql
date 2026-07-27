-- Synchronize OnlyFans model visibility with the Amplia canonical identity.
--
-- Root cause being fixed:
--  1. The Amplia client list was querying `models.talent_id`, a column that does
--     not exist in production. There was also no `talents` / `service_enrollments`
--     backfill, so active models never appeared in the regular social-media area.
--  2. New models and model status changes only touched `models.active`, leaving
--     `service_enrollments` empty and out of sync.
--
-- This migration:
--  - ensures the relevant `service_types` rows exist,
--  - backfills a `talents` row for every `models` row that is missing one,
--  - creates missing `onlyfans` service enrollments with status driven by
--    `models.active`,
--  - installs a trigger that keeps the OnlyFans enrollment and `talents.active`
--    in sync whenever `models.active` changes.

-- ---------------------------------------------------------------------------
-- Service types
-- ---------------------------------------------------------------------------
insert into public.service_types (id, key, display_name, category, platform, active)
values
  (gen_random_uuid(), 'onlyfans', 'OnlyFans', 'onlyfans_track', null, true),
  (gen_random_uuid(), 'brand_growth_instagram', 'Brand Growth — Instagram', 'brand_growth', 'instagram', true),
  (gen_random_uuid(), 'brand_growth_x', 'Brand Growth — X', 'brand_growth', 'x', true)
on conflict (key) do update set
  display_name = excluded.display_name,
  category = excluded.category,
  platform = excluded.platform,
  active = excluded.active;

-- ---------------------------------------------------------------------------
-- Backfill: create a talent row for every model that still lacks one.
-- ---------------------------------------------------------------------------
insert into public.talents (
  linked_model_id,
  legal_name,
  stage_name,
  display_name,
  location,
  nationality,
  languages,
  active,
  created_by
)
select
  m.id,
  coalesce(p.full_name, m.display_name),
  m.stage_name,
  m.display_name,
  m.city,
  m.nationality,
  case when m.language is not null then array[m.language] else '{}' end,
  m.active,
  m.created_by
from public.models m
left join public.profiles p on p.id = m.profile_id
where not exists (
  select 1 from public.talents t where t.linked_model_id = m.id
);

-- ---------------------------------------------------------------------------
-- Backfill: create onlyfans service enrollments for model-linked talents.
-- ---------------------------------------------------------------------------
insert into public.service_enrollments (
  talent_id,
  service_type_id,
  status,
  enrolled_at
)
select
  t.id,
  st.id,
  case when m.active then 'active' else 'inactive' end,
  case when m.active then now() else null end
from public.talents t
join public.models m on m.id = t.linked_model_id
join public.service_types st on st.key = 'onlyfans'
where not exists (
  select 1
  from public.service_enrollments se
  where se.talent_id = t.id
    and se.service_type_id = st.id
)
on conflict (talent_id, service_type_id) do nothing;

-- ---------------------------------------------------------------------------
-- Trigger: keep onlyfans enrollment and talent active state in sync with the
-- operational models.active toggle.
-- ---------------------------------------------------------------------------
create or replace function public.sync_model_onlyfans_enrollment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_talent_id uuid;
  v_service_type_id uuid;
  v_new_status text;
  v_any_active boolean;
begin
  -- Find or create the canonical talent for this model.
  select t.id into v_talent_id
  from public.talents t
  where t.linked_model_id = new.id;

  if v_talent_id is null then
    insert into public.talents (
      linked_model_id,
      legal_name,
      stage_name,
      display_name,
      location,
      nationality,
      languages,
      active,
      created_by
    )
    select
      new.id,
      coalesce(p.full_name, new.display_name),
      new.stage_name,
      new.display_name,
      new.city,
      new.nationality,
      case when new.language is not null then array[new.language] else '{}' end,
      new.active,
      new.created_by
    from public.profiles p
    where p.id = new.profile_id
    on conflict (linked_model_id) do nothing
    returning id into v_talent_id;

    if v_talent_id is null then
      select t.id into v_talent_id
      from public.talents t
      where t.linked_model_id = new.id;
    end if;
  end if;

  if v_talent_id is null then
    return new;
  end if;

  select id into v_service_type_id
  from public.service_types
  where key = 'onlyfans';

  if v_service_type_id is null then
    return new;
  end if;

  v_new_status := case when new.active then 'active' else 'inactive' end;

  insert into public.service_enrollments (
    talent_id,
    service_type_id,
    status,
    enrolled_at,
    updated_at
  )
  values (
    v_talent_id,
    v_service_type_id,
    v_new_status,
    case when new.active then now() else null end,
    now()
  )
  on conflict (talent_id, service_type_id) do update set
    status = excluded.status,
    enrolled_at = case
      when excluded.status = 'active' and service_enrollments.enrolled_at is null then now()
      else service_enrollments.enrolled_at
    end,
    updated_at = now();

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
--     select id from public.service_types where key in ('onlyfans', 'brand_growth_instagram', 'brand_growth_x')
--   );
--   delete from public.talents where linked_model_id is not null;

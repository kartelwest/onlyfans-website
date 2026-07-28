-- Backfill missing talent / OnlyFans enrollment links and make the sync trigger
-- fire on insert as well as update, so /admin/models and /admin/socialmediamodels
-- both read from the same service_enrollments + talents source.

-- 1. Create talents for any model that still lacks one.
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
)
on conflict (linked_model_id) do nothing;

-- 2. Create missing OnlyFans service enrollments for model-linked talents.
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

-- 3. Make the trigger also fire on model insert so future models are linked.
drop trigger if exists trg_sync_model_onlyfans_enrollment on public.models;
create trigger trg_sync_model_onlyfans_enrollment
after insert or update of active, status on public.models
for each row
execute function public.sync_model_onlyfans_enrollment();

-- Rollback notes (apply manually if needed):
--   drop trigger if exists trg_sync_model_onlyfans_enrollment on public.models;
--   create trigger trg_sync_model_onlyfans_enrollment
--     after update of active, status on public.models
--     for each row execute function public.sync_model_onlyfans_enrollment();
--   delete from public.service_enrollments
--     where talent_id in (select id from public.talents where linked_model_id is not null)
--       and service_type_id in (select id from public.service_types where key = 'onlyfans');
--   delete from public.talents where linked_model_id is not null;

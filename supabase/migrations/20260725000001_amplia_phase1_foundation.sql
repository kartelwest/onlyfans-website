-- =============================================================================
-- Amplia (Brand Growth module) — Phase 1: foundation
--
-- Additive only. Does not alter or drop any existing OnlyFans CRM table.
-- Reuses public.is_management() / public.is_owner() (owner+administrator /
-- owner-only checks) which already exist and are already used by the live
-- models/model_* RLS policies — no new helper functions needed.
--
-- Also creates app_settings: the repo's supabase/migrations/20260723180000_
-- add_app_settings.sql file was written but, per introspection against the
-- live project, was NEVER actually applied (to_regclass('public.app_settings')
-- returned null before this migration) — one of several instances of
-- migration-file/live-DB drift found during the Phase 0 audit (see also:
-- 20260722000001_initial_schema.sql and 20260722000002_rls_policies.sql,
-- which likewise never ran against the live database — its schema was
-- bootstrapped some other way and only diverged further from there).
-- Created here (adapted to the live is_management()/is_owner() functions —
-- the original file's is_staff() doesn't exist under that name on the live
-- DB) because both the existing model-importer auto-save toggle and Amplia's
-- module naming / X-flag config need it.
--
-- Identity model: `talents` is the shared Brand-Growth identity row.
--   - Track A (existing OF model also doing Brand Growth): talents.linked_model_id
--     points at models.id. models stays the system of record for OF/Fansly
--     operational data; Amplia never writes to models.
--   - Track B (Brand-Growth-only client, no OnlyFans): talents.linked_model_id
--     is null; identity fields live on talents itself.
-- service_enrollments records which services (onlyfans/fansly/brand_growth_
-- instagram/brand_growth_x) are switched on for a talent. For onlyfans/fansly
-- rows this is an informational flag for Amplia's own display only — it is
-- NOT authoritative and must never be treated as the source of truth for OF
-- CRM logic (that remains models/model_platforms/model_checklist).
--
-- This file was applied to the live project via the Supabase MCP tools
-- (apply_migration) across a few small follow-up statements — including a
-- fix for a real bug caught immediately after applying (client_consent_status
-- defaulted to SECURITY DEFINER view behavior, which would have bypassed RLS
-- on client_consents for every authenticated user). It is consolidated here
-- into one coherent file matching the final live state, so the checked-in
-- migration history doesn't drift further from this point forward.
-- =============================================================================

-- ----- app_settings (small key/value store; existing model-importer toggle
--       already assumes this exists — it just never got applied) -------------
create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);
create trigger trg_app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value)
values ('model_importer_auto_save', 'false'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;
create policy app_settings_select on public.app_settings for select to authenticated
  using ( public.is_management() );
create policy app_settings_insert on public.app_settings for insert to authenticated
  with check ( public.is_owner() );
create policy app_settings_update on public.app_settings for update to authenticated
  using ( public.is_owner() ) with check ( public.is_owner() );

-- ----- talents -----------------------------------------------------------
create table public.talents (
  id                    uuid primary key default gen_random_uuid(),
  linked_model_id       uuid unique references public.models(id) on delete set null,
  legal_name            text,
  stage_name            text not null check (btrim(stage_name) <> ''),
  display_name          text not null check (btrim(display_name) <> ''),
  pronunciation         text,
  preferred_username    text,
  alternate_usernames   text[] not null default '{}',
  approved_age          integer,
  location              text,
  nationality            text,
  languages             text[] not null default '{}',
  occupation            text,
  brand_category        text,
  active                boolean not null default true,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index talents_linked_model_id_idx on public.talents(linked_model_id);
create index talents_active_idx on public.talents(active);
create trigger trg_talents_updated_at before update on public.talents
  for each row execute function public.set_updated_at();

-- ----- service_types (seeded catalog) -------------------------------------
create table public.service_types (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  display_name  text not null,
  category      text not null check (category in ('onlyfans_track','brand_growth')),
  platform      text check (platform in ('instagram','x')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

insert into public.service_types (key, display_name, category, platform) values
  ('onlyfans',              'OnlyFans',              'onlyfans_track', null),
  ('fansly',                'Fansly',                'onlyfans_track', null),
  ('brand_growth_instagram','Brand Growth — Instagram','brand_growth', 'instagram'),
  ('brand_growth_x',        'Brand Growth — X',       'brand_growth',  'x');

-- ----- service_enrollments -------------------------------------------------
create table public.service_enrollments (
  id                uuid primary key default gen_random_uuid(),
  talent_id         uuid not null references public.talents(id) on delete cascade,
  service_type_id   uuid not null references public.service_types(id),
  status            text not null default 'inactive'
                       check (status in ('inactive','planning','active','paused','archived')),
  enrolled_at       timestamptz,
  enrolled_by       uuid references public.profiles(id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (talent_id, service_type_id)
);
create index service_enrollments_talent_id_idx on public.service_enrollments(talent_id);
create trigger trg_service_enrollments_updated_at before update on public.service_enrollments
  for each row execute function public.set_updated_at();

-- ----- brand_profiles --------------------------------------------------------
-- One brand profile per talent; niches + standing AI guidance steer BOTH
-- Instagram and X generation per spec section 7.3b.
create table public.brand_profiles (
  id                      uuid primary key default gen_random_uuid(),
  talent_id               uuid not null unique references public.talents(id) on delete cascade,
  niche_1                 text not null check (btrim(niche_1) <> ''),
  niche_2                 text,
  niche_3                 text,
  ai_guidance             text,
  primary_positioning     text,
  secondary_positioning   text[] not null default '{}',
  brand_voice             text,
  target_countries        text[] not null default '{}',
  target_cities           text[] not null default '{}',
  target_languages        text[] not null default '{}',
  target_gender           text,
  target_age_min          integer,
  target_age_max          integer,
  target_interests        text[] not null default '{}',
  desired_partnerships    text,
  markets_to_avoid        text[] not null default '{}',
  topics_to_avoid         text[] not null default '{}',
  status                  text not null default 'draft' check (status in ('draft','active','archived')),
  created_by              uuid references public.profiles(id) on delete set null,
  updated_by              uuid references public.profiles(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger trg_brand_profiles_updated_at before update on public.brand_profiles
  for each row execute function public.set_updated_at();

-- ----- brand_profile_versions (append-only audit snapshot) -------------------
create table public.brand_profile_versions (
  id                uuid primary key default gen_random_uuid(),
  brand_profile_id  uuid not null references public.brand_profiles(id) on delete cascade,
  talent_id         uuid not null references public.talents(id) on delete cascade,
  snapshot          jsonb not null,
  changed_by        uuid references public.profiles(id) on delete set null,
  change_reason     text,
  created_at        timestamptz not null default now()
);
create index brand_profile_versions_brand_profile_id_idx
  on public.brand_profile_versions(brand_profile_id, created_at desc);

create or replace function public.snapshot_brand_profile_version()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.brand_profile_versions (brand_profile_id, talent_id, snapshot, changed_by)
  values (old.id, old.talent_id, to_jsonb(old), auth.uid());
  return new;
end $$;
create trigger trg_brand_profiles_snapshot before update on public.brand_profiles
  for each row execute function public.snapshot_brand_profile_version();

-- Trigger-only function — never meant to be called directly via PostgREST RPC.
revoke execute on function public.snapshot_brand_profile_version() from public;
revoke execute on function public.snapshot_brand_profile_version() from anon;
revoke execute on function public.snapshot_brand_profile_version() from authenticated;

-- ----- growth_goals ----------------------------------------------------------
create table public.growth_goals (
  id                  uuid primary key default gen_random_uuid(),
  talent_id           uuid not null references public.talents(id) on delete cascade,
  platform            text check (platform in ('instagram','x')),
  objective           text not null check (btrim(objective) <> ''),
  priority            text not null default 'medium' check (priority in ('low','medium','high')),
  start_value         numeric,
  target_value        numeric,
  target_date         date,
  measurement_method  text,
  status              text not null default 'active' check (status in ('active','achieved','missed','archived')),
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index growth_goals_talent_id_idx on public.growth_goals(talent_id);
create trigger trg_growth_goals_updated_at before update on public.growth_goals
  for each row execute function public.set_updated_at();

-- ----- client_consents (append-only auditable log) ---------------------------
-- Every grant/revoke is a new row; "current" status = latest row per
-- (talent_id, consent_type). Never updated or deleted in place.
create table public.client_consents (
  id               uuid primary key default gen_random_uuid(),
  talent_id        uuid not null references public.talents(id) on delete cascade,
  consent_type     text not null check (consent_type in (
                     'legal_name_use','face_use','voice_use',
                     'ai_generated_image_use','ai_enhanced_image_use','ai_generated_video_use',
                     'location_age_relationship_disclosure','adult_platform_links',
                     'content_repurposing','cross_platform_publishing','automatic_publishing',
                     'ai_generated_replies','data_use_for_strategy')),
  granted          boolean not null,
  effective_date   date not null default current_date,
  recorded_by      uuid references public.profiles(id) on delete set null,
  notes            text,
  created_at       timestamptz not null default now()
);
create index client_consents_talent_type_idx
  on public.client_consents(talent_id, consent_type, created_at desc);

-- security_invoker = true: without it, a Postgres view defaults to running
-- with the privileges/RLS-bypass of the view's OWNER for underlying-table
-- access, not the querying user. Since this view is created by a privileged
-- migration role, omitting this would let ANY authenticated user read every
-- talent's consent status regardless of role, bypassing client_consents'
-- management-only RLS policy entirely. Caught and fixed immediately after
-- first applying this migration live — flagged here so it's never dropped
-- by a future refactor.
create view public.client_consent_status
  with (security_invoker = true) as
select distinct on (talent_id, consent_type)
  talent_id, consent_type, granted, effective_date, recorded_by, notes, created_at
from public.client_consents
order by talent_id, consent_type, created_at desc;

-- ----- client_boundaries -------------------------------------------------------
create table public.client_boundaries (
  id                             uuid primary key default gen_random_uuid(),
  talent_id                      uuid not null unique references public.talents(id) on delete cascade,
  prohibited_subjects            text[] not null default '{}',
  prohibited_words               text[] not null default '{}',
  political_boundary             text,
  religious_boundary             text,
  sexual_boundary                text,
  clothing_boundary              text,
  comment_boundary               text,
  dm_boundary                    text,
  accounts_not_to_mention        text[] not null default '{}',
  private_details_never_reveal   text[] not null default '{}',
  crisis_topics                  text[] not null default '{}',
  created_by                     uuid references public.profiles(id) on delete set null,
  updated_by                     uuid references public.profiles(id) on delete set null,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now()
);
create trigger trg_client_boundaries_updated_at before update on public.client_boundaries
  for each row execute function public.set_updated_at();

-- ----- RLS: every Amplia table is owner/administrator only, full stop --------
-- No representative/model/client-portal access exists yet (client portal is
-- a later phase; representatives never auto-receive Brand Growth access per
-- spec section 8).
alter table public.talents                 enable row level security;
alter table public.service_types           enable row level security;
alter table public.service_enrollments     enable row level security;
alter table public.brand_profiles          enable row level security;
alter table public.brand_profile_versions  enable row level security;
alter table public.growth_goals            enable row level security;
alter table public.client_consents         enable row level security;
alter table public.client_boundaries       enable row level security;

create policy talents_management_all on public.talents for all to authenticated
  using ( public.is_management() ) with check ( public.is_management() );

create policy service_types_select_management on public.service_types for select to authenticated
  using ( public.is_management() );
create policy service_types_write_owner on public.service_types for all to authenticated
  using ( public.is_owner() ) with check ( public.is_owner() );

create policy service_enrollments_management_all on public.service_enrollments for all to authenticated
  using ( public.is_management() ) with check ( public.is_management() );

create policy brand_profiles_management_all on public.brand_profiles for all to authenticated
  using ( public.is_management() ) with check ( public.is_management() );

create policy brand_profile_versions_select_management on public.brand_profile_versions for select to authenticated
  using ( public.is_management() );
create policy brand_profile_versions_insert_management on public.brand_profile_versions for insert to authenticated
  with check ( public.is_management() );

create policy growth_goals_management_all on public.growth_goals for all to authenticated
  using ( public.is_management() ) with check ( public.is_management() );

create policy client_consents_select_management on public.client_consents for select to authenticated
  using ( public.is_management() );
create policy client_consents_insert_management on public.client_consents for insert to authenticated
  with check ( public.is_management() );

create policy client_boundaries_management_all on public.client_boundaries for all to authenticated
  using ( public.is_management() ) with check ( public.is_management() );

-- ----- Amplia configuration (module name / display name / X feature flag) ---
insert into public.app_settings (key, value) values
  ('amplia_module_code_name', '"Brand Growth"'::jsonb),
  ('amplia_display_name',     '"Amplia"'::jsonb),
  ('feature_x_enabled',       'false'::jsonb)
on conflict (key) do nothing;

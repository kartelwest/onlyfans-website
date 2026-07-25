-- =============================================================================
-- Amplia Brand Growth — foundation schema
-- Adds the shared `talents` identity, modular `service_enrollments`, the
-- `brand_profiles` extension, consents/boundaries, and all support tables.
-- Designed to be idempotent and to co-exist with the existing KARAY Models CRM.
-- =============================================================================

-- ----- Enums -----------------------------------------------------------------
do $$ begin
  create type public.platform as enum (
    'instagram', 'x', 'tiktok', 'youtube', 'facebook', 'reddit', 'onlyfans', 'fansly'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.brand_account_status as enum (
    'not_requested','planning','awaiting_client_information','launch_packet_ready',
    'awaiting_manual_account_creation','awaiting_verification','awaiting_connection',
    'connected','active','authorization_expired','restricted','suspended',
    'disconnected','archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_status as enum (
    'draft','ai_generated','awaiting_media','awaiting_client_approval',
    'awaiting_agency_approval','approved','scheduled','publishing','published',
    'failed','paused','rejected','archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_type as enum (
    'feed_image','feed_carousel','reel','story','x_post','x_thread','story_series'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.automation_mode as enum ('manual','approval_based','controlled_autopilot');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.alert_severity as enum (
    'informational','recommendation','action_required','high_risk','critical'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.content_source as enum ('api','manual','ai_generated','imported','repurposed');
exception when duplicate_object then null; end $$;

-- Extend existing role enum with new Brand Growth operational roles.
-- These can be added safely while existing values remain in use.
alter type public.management_role add value if not exists 'brand_manager';
alter type public.management_role add value if not exists 'content_manager';
alter type public.management_role add value if not exists 'analyst';
alter type public.management_role add value if not exists 'reviewer';

-- ----- Helper predicates -----------------------------------------------------
-- Generic helpers for the new Brand Growth module. They mirror the style of
-- public.is_staff() / is_owner() and are granted to authenticated below.

create or replace function public.is_brand_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select active and role in ('owner','administrator','brand_manager','content_manager','analyst','reviewer')
    from public.profiles where id = auth.uid()
  ), false)
$$;

create or replace function public.is_brand_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select active and role in ('owner','administrator','brand_manager','content_manager')
    from public.profiles where id = auth.uid()
  ), false)
$$;

create or replace function public.can_manage_brand_talent(target_talent uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_brand_staff()
      or exists (
        select 1 from public.talents t
         where t.id = target_talent and t.profile_id = auth.uid()
      )
$$;

create or replace function public.is_assigned_to_talent(target_talent uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_user() and exists (
    select 1 from public.talent_assignments ta
     where ta.talent_id = target_talent and ta.profile_id = auth.uid() and ta.active
  )
$$;

-- Grant helpers to authenticated so RLS policies can call them.
grant execute on function
  public.is_brand_staff(),
  public.is_brand_editor(),
  public.can_manage_brand_talent(uuid),
  public.is_assigned_to_talent(uuid)
to authenticated;

-- ----- talents (shared identity) --------------------------------------------
create table if not exists public.talents (
  id                  uuid primary key default gen_random_uuid(),
  profile_id          uuid unique references public.profiles(id) on delete set null,
  model_id            uuid unique references public.models(id) on delete set null,
  -- Identity
  legal_name          text,
  stage_name          text,
  display_name        text not null default '',
  preferred_username  text,
  pronunciation       text,
  -- Contact
  email               text,
  whatsapp            text,
  -- Demographics
  birthday            date,
  age                 integer check (age is null or age >= 18),
  location            text,
  nationality         text,
  languages           text[],
  occupation          text,
  -- Service toggles (master, enrollment details live in service_enrollments)
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists talents_profile_id_idx on public.talents(profile_id);
create index if not exists talents_model_id_idx on public.talents(model_id);
create index if not exists talents_active_idx on public.talents(active);

drop trigger if exists trg_talents_updated_at on public.talents;
create trigger trg_talents_updated_at before update on public.talents
  for each row execute function public.set_updated_at();

-- Link existing models to a talent. For models created before Amplia,
-- this backfills a `talents` row with data copied from `models`.
-- Runs only for models without an existing talent link.
insert into public.talents (profile_id, model_id, legal_name, stage_name, display_name,
                            preferred_username, email, whatsapp, birthday, nationality,
                            location, languages, active)
select
  m.profile_id,
  m.id,
  p.full_name,
  m.stage_name,
  m.display_name,
  m.instagram,
  m.email,
  m.whatsapp,
  m.birthday,
  m.nationality,
  m.city,
  case when m.language is not null then array[m.language] else null end,
  m.active
from public.models m
join public.profiles p on p.id = m.profile_id
where m.profile_id is not null
  and not exists (select 1 from public.talents t where t.model_id = m.id)
on conflict (profile_id) do nothing;

-- ----- model → talent link (adds talent_id to models) ------------------------
alter table public.models
  add column if not exists talent_id uuid references public.talents(id) on delete set null;

update public.models m
set talent_id = t.id
from public.talents t
where t.model_id = m.id and m.talent_id is distinct from t.id;

-- Re-apply column allowlist so authenticated can select the new talent_id.
-- This preserves the security model from 20260724000002_models_column_select_allowlist.sql.
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

-- ----- service_types & service_enrollments ----------------------------------
create table if not exists public.service_types (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name        text not null,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_service_types_updated_at on public.service_types;
create trigger trg_service_types_updated_at before update on public.service_types
  for each row execute function public.set_updated_at();

insert into public.service_types (code, name, description) values
  ('onlyfans', 'OnlyFans', 'OnlyFans creator account management'),
  ('fansly', 'Fansly', 'Fansly creator account management'),
  ('brand_growth', 'Brand Growth', 'Amplia brand growth and social media management')
on conflict (code) do nothing;

create table if not exists public.service_enrollments (
  id              uuid primary key default gen_random_uuid(),
  talent_id       uuid not null references public.talents(id) on delete cascade,
  service_type_id uuid not null references public.service_types(id) on delete cascade,
  status          text not null default 'not_started',
  started_at      timestamptz,
  paused_at       timestamptz,
  ended_at        timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (talent_id, service_type_id)
);

create index if not exists service_enrollments_talent_id_idx on public.service_enrollments(talent_id);
create index if not exists service_enrollments_service_type_id_idx on public.service_enrollments(service_type_id);

drop trigger if exists trg_service_enrollments_updated_at on public.service_enrollments;
create trigger trg_service_enrollments_updated_at before update on public.service_enrollments
  for each row execute function public.set_updated_at();

-- Backfill: existing models are enrolled in OnlyFans; brand_growth remains off until admin opts in.
insert into public.service_enrollments (talent_id, service_type_id, status, started_at)
select
  t.id,
  st.id,
  'active',
  now()
from public.talents t
join public.service_types st on st.code = 'onlyfans'
where t.model_id is not null
on conflict (talent_id, service_type_id) do nothing;

-- ----- talent_assignments (brand team ↔ talent) -----------------------------
create table if not exists public.talent_assignments (
  id          uuid primary key default gen_random_uuid(),
  talent_id   uuid not null references public.talents(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'brand_manager',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (talent_id, profile_id, role)
);

create index if not exists talent_assignments_talent_id_idx on public.talent_assignments(talent_id);
create index if not exists talent_assignments_profile_id_idx on public.talent_assignments(profile_id);

drop trigger if exists trg_talent_assignments_updated_at on public.talent_assignments;
create trigger trg_talent_assignments_updated_at before update on public.talent_assignments
  for each row execute function public.set_updated_at();

-- ----- brand_profiles (Brand Growth extension for a talent) ------------------
create table if not exists public.brand_profiles (
  id                              uuid primary key default gen_random_uuid(),
  talent_id                       uuid not null unique references public.talents(id) on delete cascade,
  -- Brand identity
  display_name                    text,
  pronunciation                   text,
  preferred_username              text,
  alternate_usernames             text[],
  age                             integer check (age is null or age >= 18),
  location                        text,
  nationality                     text,
  languages                       text[],
  occupation                      text,
  brand_category                  text,
  niche_1                         text not null default 'lifestyle',
  niche_2                         text,
  niche_3                         text,
  -- Personality / positioning
  primary_positioning             text,
  secondary_positioning           text,
  custom_positioning              text,
  -- Audience
  target_countries                 text[],
  target_cities                    text[],
  target_languages                 text[],
  target_gender                    text,
  target_age_min                   integer,
  target_age_max                   integer,
  target_interests                 text[],
  desired_partnerships             text,
  desired_follower_profile         text,
  markets_to_avoid                 text[],
  -- Objectives (JSON array of goal objects for flexibility)
  objectives                      jsonb not null default '[]'::jsonb,
  -- Automation settings
  instagram_automation_mode       public.automation_mode not null default 'manual',
  x_automation_mode               public.automation_mode not null default 'manual',
  -- Status
  brand_status                    text not null default 'planning',
  -- AI steering
  ai_guidance                     text,
  -- Configuration
  default_languages               text[] not null default '{"pt-BR"}',
  allow_adult_platform_links      boolean not null default false,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now()
);

create index if not exists brand_profiles_talent_id_idx on public.brand_profiles(talent_id);

drop trigger if exists trg_brand_profiles_updated_at on public.brand_profiles;
create trigger trg_brand_profiles_updated_at before update on public.brand_profiles
  for each row execute function public.set_updated_at();

-- ----- brand_profile_versions -----------------------------------------------
create table if not exists public.brand_profile_versions (
  id                  uuid primary key default gen_random_uuid(),
  brand_profile_id    uuid not null references public.brand_profiles(id) on delete cascade,
  version_number      integer not null,
  changed_by          uuid references public.profiles(id) on delete set null,
  change_reason       text,
  snapshot            jsonb not null,
  created_at          timestamptz not null default now()
);

create index if not exists brand_profile_versions_brand_profile_id_idx on public.brand_profile_versions(brand_profile_id);
create index if not exists brand_profile_versions_version_number_idx on public.brand_profile_versions(brand_profile_id, version_number desc);

-- ----- client_consents --------------------------------------------------------
create table if not exists public.client_consents (
  id                              uuid primary key default gen_random_uuid(),
  talent_id                       uuid not null references public.talents(id) on delete cascade,
  consent_key                     text not null,
  granted                         boolean not null default false,
  granted_at                      timestamptz,
  granted_by_profile_id           uuid references public.profiles(id) on delete set null,
  notes                           text,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  unique (talent_id, consent_key)
);

create index if not exists client_consents_talent_id_idx on public.client_consents(talent_id);

drop trigger if exists trg_client_consents_updated_at on public.client_consents;
create trigger trg_client_consents_updated_at before update on public.client_consents
  for each row execute function public.set_updated_at();

-- Seed standard consent keys.
insert into public.client_consents (talent_id, consent_key)
select t.id, k
from public.talents t
cross join (
  values
    ('legal_name_use'), ('face_use'), ('voice_use'),
    ('ai_generated_image_use'), ('ai_enhanced_image_use'), ('ai_generated_video_use'),
    ('location_age_relationship_disclosure'), ('links_to_adult_platforms'),
    ('content_repurposing'), ('cross_platform_publishing'),
    ('automatic_publishing'), ('ai_generated_replies'), ('data_use_for_strategy')
) as keys(k)
on conflict (talent_id, consent_key) do nothing;

-- ----- client_boundaries ------------------------------------------------------
create table if not exists public.client_boundaries (
  id                          uuid primary key default gen_random_uuid(),
  talent_id                   uuid not null references public.talents(id) on delete cascade,
  -- Prohibited subjects/words
  prohibited_subjects         text[] not null default '{}',
  prohibited_words            text[] not null default '{}',
  -- Boundaries
  political_boundary          text,
  religious_boundary          text,
  sexual_boundary             text,
  clothing_boundary           text,
  comment_dm_boundary         text,
  accounts_not_to_mention     text[] not null default '{}',
  private_details_never_reveal  text[] not null default '{}',
  crisis_topics               text[] not null default '{}',
  -- Risk/policy flags
  never_generate_nudity       boolean not null default true,
  never_impersonate_real      boolean not null default true,
  never_misleading_claims       boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists client_boundaries_talent_id_idx on public.client_boundaries(talent_id);

drop trigger if exists trg_client_boundaries_updated_at on public.client_boundaries;
create trigger trg_client_boundaries_updated_at before update on public.client_boundaries
  for each row execute function public.set_updated_at();

-- Ensure one boundaries row per talent.
insert into public.client_boundaries (talent_id)
select id from public.talents t
where not exists (select 1 from public.client_boundaries b where b.talent_id = t.id);

-- ----- social_accounts --------------------------------------------------------
create table if not exists public.social_accounts (
  id                  uuid primary key default gen_random_uuid(),
  talent_id           uuid not null references public.talents(id) on delete cascade,
  platform            public.platform not null,
  username            text,
  display_name        text,
  profile_url         text,
  bio                 text,
  profile_picture_url text,
  banner_url          text,
  is_professional     boolean not null default false,
  status              public.brand_account_status not null default 'not_requested',
  follower_count      integer not null default 0 check (follower_count >= 0),
  following_count     integer not null default 0 check (following_count >= 0),
  post_count          integer not null default 0 check (post_count >= 0),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (talent_id, platform, username)
);

create index if not exists social_accounts_talent_id_idx on public.social_accounts(talent_id);
create index if not exists social_accounts_platform_idx on public.social_accounts(platform);

drop trigger if exists trg_social_accounts_updated_at on public.social_accounts;
create trigger trg_social_accounts_updated_at before update on public.social_accounts
  for each row execute function public.set_updated_at();

-- ----- social_account_connections ---------------------------------------------
-- OAuth / authorization metadata. Tokens themselves are NOT stored here.
create table if not exists public.social_account_connections (
  id                  uuid primary key default gen_random_uuid(),
  social_account_id   uuid not null unique references public.social_accounts(id) on delete cascade,
  app_id              text,
  app_name            text,
  scope_granted       text[] not null default '{}',
  authorized_at       timestamptz,
  expires_at          timestamptz,
  refresh_enabled     boolean not null default false,
  business_verified   boolean not null default false,
  app_review_approved boolean not null default false,
  raw_connection_meta jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists social_account_connections_social_account_id_idx on public.social_account_connections(social_account_id);

drop trigger if exists trg_social_account_connections_updated_at on public.social_account_connections;
create trigger trg_social_account_connections_updated_at before update on public.social_account_connections
  for each row execute function public.set_updated_at();

-- ----- social_account_tokens --------------------------------------------------
-- Encrypted token material. The encrypted blob is base64-encoded text.
create table if not exists public.social_account_tokens (
  id                  uuid primary key default gen_random_uuid(),
  social_account_id   uuid not null unique references public.social_accounts(id) on delete cascade,
  encrypted_access_token  text,
  encrypted_refresh_token text,
  access_token_expires_at timestamptz,
  token_version       integer not null default 1,
  last_rotated_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists social_account_tokens_social_account_id_idx on public.social_account_tokens(social_account_id);

drop trigger if exists trg_social_account_tokens_updated_at on public.social_account_tokens;
create trigger trg_social_account_tokens_updated_at before update on public.social_account_tokens
  for each row execute function public.set_updated_at();

-- ----- social_account_status_history ------------------------------------------
create table if not exists public.social_account_status_history (
  id                  uuid primary key default gen_random_uuid(),
  social_account_id   uuid not null references public.social_accounts(id) on delete cascade,
  from_status         text,
  to_status           text not null,
  changed_by          uuid references public.profiles(id) on delete set null,
  reason              text,
  created_at          timestamptz not null default now()
);

create index if not exists social_account_status_history_social_account_id_idx on public.social_account_status_history(social_account_id);

-- ----- content_assets ---------------------------------------------------------
-- Approved media / content inventory for a talent.
create table if not exists public.content_assets (
  id                  uuid primary key default gen_random_uuid(),
  talent_id           uuid not null references public.talents(id) on delete cascade,
  uploader_profile_id uuid references public.profiles(id) on delete set null,
  title               text,
  description         text,
  asset_type          text not null, -- photo, video, reel, bts, travel, lifestyle, product, logo, voice, etc.
  storage_bucket      text not null,
  storage_path        text not null,
  mime_type           text,
  file_size           bigint,
  width               integer,
  height              integer,
  duration_seconds    numeric(10,2),
  original_asset_id   uuid references public.content_assets(id) on delete set null,
  editing_method      text,
  ai_provider         text,
  consent_basis       text,
  usage_expires_at    timestamptz,
  ownership_status    text default 'owned',
  release_document_path text,
  is_archived         boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists content_assets_talent_id_idx on public.content_assets(talent_id);
create index if not exists content_assets_asset_type_idx on public.content_assets(asset_type);

drop trigger if exists trg_content_assets_updated_at on public.content_assets;
create trigger trg_content_assets_updated_at before update on public.content_assets
  for each row execute function public.set_updated_at();

-- ----- asset_usage ------------------------------------------------------------
create table if not exists public.asset_usage (
  id                  uuid primary key default gen_random_uuid(),
  asset_id            uuid not null references public.content_assets(id) on delete cascade,
  content_item_id     uuid not null,
  platform            public.platform,
  usage_type          text not null, -- source, edited, published
  used_at             timestamptz not null default now(),
  used_by             uuid references public.profiles(id) on delete set null
);

create index if not exists asset_usage_asset_id_idx on public.asset_usage(asset_id);

-- ----- content_pillars --------------------------------------------------------
create table if not exists public.content_pillars (
  id                  uuid primary key default gen_random_uuid(),
  brand_profile_id    uuid not null references public.brand_profiles(id) on delete cascade,
  name                text not null,
  description         text,
  platform            public.platform,
  priority            integer not null default 0,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists content_pillars_brand_profile_id_idx on public.content_pillars(brand_profile_id);

drop trigger if exists trg_content_pillars_updated_at on public.content_pillars;
create trigger trg_content_pillars_updated_at before update on public.content_pillars
  for each row execute function public.set_updated_at();

-- ----- content_ideas ----------------------------------------------------------
create table if not exists public.content_ideas (
  id                  uuid primary key default gen_random_uuid(),
  brand_profile_id    uuid not null references public.brand_profiles(id) on delete cascade,
  platform            public.platform not null,
  content_type        public.content_type not null,
  title               text,
  concept             text,
  suggested_caption   text,
  suggested_hashtags  text[],
  suggested_keywords  text[],
  suggested_time      timestamptz,
  pillar_id           uuid references public.content_pillars(id) on delete set null,
  status              public.content_status not null default 'draft',
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists content_ideas_brand_profile_id_idx on public.content_ideas(brand_profile_id);

drop trigger if exists trg_content_ideas_updated_at on public.content_ideas;
create trigger trg_content_ideas_updated_at before update on public.content_ideas
  for each row execute function public.set_updated_at();

-- ----- content_items (master content record) ----------------------------------
create table if not exists public.content_items (
  id                  uuid primary key default gen_random_uuid(),
  talent_id           uuid not null references public.talents(id) on delete cascade,
  brand_profile_id    uuid references public.brand_profiles(id) on delete set null,
  social_account_id   uuid references public.social_accounts(id) on delete set null,
  platform            public.platform not null,
  content_type        public.content_type not null,
  title               text,
  body                text,
  caption             text,
  hashtags            text[],
  keywords            text[],
  alt_text            text,
  cta                 text,
  media_asset_ids     uuid[] not null default '{}',
  source              public.content_source not null default 'ai_generated',
  status              public.content_status not null default 'draft',
  scheduled_for       timestamptz,
  published_at        timestamptz,
  published_url       text,
  external_id         text,
  risk_status         text,
  ai_generation_id    uuid,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists content_items_talent_id_idx on public.content_items(talent_id);
create index if not exists content_items_status_idx on public.content_items(status);
create index if not exists content_items_scheduled_for_idx on public.content_items(scheduled_for) where status in ('scheduled','publishing');

drop trigger if exists trg_content_items_updated_at on public.content_items;
create trigger trg_content_items_updated_at before update on public.content_items
  for each row execute function public.set_updated_at();

-- ----- content_versions -------------------------------------------------------
create table if not exists public.content_versions (
  id                  uuid primary key default gen_random_uuid(),
  content_item_id     uuid not null references public.content_items(id) on delete cascade,
  version_number      integer not null,
  body                text,
  caption             text,
  hashtags            text[],
  changed_by          uuid references public.profiles(id) on delete set null,
  change_reason       text,
  created_at          timestamptz not null default now()
);

create index if not exists content_versions_content_item_id_idx on public.content_versions(content_item_id);

-- ----- content_approvals ------------------------------------------------------
create table if not exists public.content_approvals (
  id                  uuid primary key default gen_random_uuid(),
  content_item_id     uuid not null references public.content_items(id) on delete cascade,
  approver_profile_id uuid references public.profiles(id) on delete set null,
  approver_role       text,
  approval_type       text not null,
  approved            boolean not null default false,
  comments            text,
  restrictions        text[],
  reuse_allowed       boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists content_approvals_content_item_id_idx on public.content_approvals(content_item_id);

-- ----- publishing_jobs --------------------------------------------------------
create table if not exists public.publishing_jobs (
  id                  uuid primary key default gen_random_uuid(),
  content_item_id     uuid not null unique references public.content_items(id) on delete cascade,
  social_account_id   uuid not null references public.social_accounts(id) on delete cascade,
  platform            public.platform not null,
  status              text not null default 'pending',
  idempotency_key     text not null unique,
  scheduled_for       timestamptz,
  started_at          timestamptz,
  completed_at        timestamptz,
  external_container_id text,
  external_publish_id text,
  retry_count         integer not null default 0,
  max_retries         integer not null default 3,
  error_class         text,
  error_message       text,
  raw_response        jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists publishing_jobs_status_idx on public.publishing_jobs(status);
create index if not exists publishing_jobs_scheduled_for_idx on public.publishing_jobs(scheduled_for) where status in ('pending','scheduled','retrying');

drop trigger if exists trg_publishing_jobs_updated_at on public.publishing_jobs;
create trigger trg_publishing_jobs_updated_at before update on public.publishing_jobs
  for each row execute function public.set_updated_at();

-- ----- publishing_attempts ----------------------------------------------------
create table if not exists public.publishing_attempts (
  id                  uuid primary key default gen_random_uuid(),
  publishing_job_id   uuid not null references public.publishing_jobs(id) on delete cascade,
  attempted_at        timestamptz not null default now(),
  status              text not null,
  error_class         text,
  error_message       text,
  raw_response        jsonb
);

create index if not exists publishing_attempts_publishing_job_id_idx on public.publishing_attempts(publishing_job_id);

-- ----- content_calendar_entries -----------------------------------------------
-- Denormalized calendar view; can be generated from content_items + publishing_jobs.
create table if not exists public.content_calendar_entries (
  id                  uuid primary key default gen_random_uuid(),
  talent_id           uuid not null references public.talents(id) on delete cascade,
  content_item_id     uuid references public.content_items(id) on delete set null,
  social_account_id   uuid references public.social_accounts(id) on delete set null,
  platform            public.platform not null,
  scheduled_date      date not null,
  scheduled_time      timestamptz,
  status              public.content_status not null default 'draft',
  title               text,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists content_calendar_entries_talent_id_idx on public.content_calendar_entries(talent_id);
create index if not exists content_calendar_entries_date_idx on public.content_calendar_entries(scheduled_date);

drop trigger if exists trg_content_calendar_entries_updated_at on public.content_calendar_entries;
create trigger trg_content_calendar_entries_updated_at before update on public.content_calendar_entries
  for each row execute function public.set_updated_at();

-- ----- platform_metrics -------------------------------------------------------
create table if not exists public.platform_metrics (
  id                  uuid primary key default gen_random_uuid(),
  social_account_id   uuid not null references public.social_accounts(id) on delete cascade,
  platform            public.platform not null,
  metric_name         text not null,
  metric_value        numeric(18,4) not null default 0,
  metric_period       text, -- day, week, month, lifetime
  period_start        date,
  period_end          date,
  source              public.content_source not null default 'api',
  raw_payload         jsonb,
  recorded_at         timestamptz not null default now()
);

create index if not exists platform_metrics_social_account_id_idx on public.platform_metrics(social_account_id);
create index if not exists platform_metrics_period_idx on public.platform_metrics(social_account_id, metric_name, period_start);

-- ----- content_metrics --------------------------------------------------------
create table if not exists public.content_metrics (
  id                  uuid primary key default gen_random_uuid(),
  content_item_id     uuid not null references public.content_items(id) on delete cascade,
  platform            public.platform not null,
  metric_name         text not null,
  metric_value        numeric(18,4) not null default 0,
  source              public.content_source not null default 'api',
  raw_payload         jsonb,
  recorded_at         timestamptz not null default now()
);

create index if not exists content_metrics_content_item_id_idx on public.content_metrics(content_item_id);

-- ----- daily_account_metrics --------------------------------------------------
-- Cached daily rollup of account-level metrics for quick dashboard reads.
create table if not exists public.daily_account_metrics (
  id                  uuid primary key default gen_random_uuid(),
  social_account_id   uuid not null references public.social_accounts(id) on delete cascade,
  metric_date         date not null,
  followers           integer not null default 0,
  reach               integer not null default 0,
  impressions         integer not null default 0,
  profile_visits      integer not null default 0,
  link_clicks         integer not null default 0,
  engagement_rate     numeric(8,4),
  source              public.content_source not null default 'api',
  raw_payload         jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (social_account_id, metric_date)
);

create index if not exists daily_account_metrics_social_account_id_idx on public.daily_account_metrics(social_account_id);

drop trigger if exists trg_daily_account_metrics_updated_at on public.daily_account_metrics;
create trigger trg_daily_account_metrics_updated_at before update on public.daily_account_metrics
  for each row execute function public.set_updated_at();

-- ----- growth_goals -----------------------------------------------------------
create table if not exists public.growth_goals (
  id                  uuid primary key default gen_random_uuid(),
  brand_profile_id    uuid not null references public.brand_profiles(id) on delete cascade,
  name                text not null,
  priority            integer not null default 0,
  start_value         numeric(18,4) not null default 0,
  target_value        numeric(18,4) not null default 0,
  target_date         date,
  measurement_method  text,
  current_value       numeric(18,4) not null default 0,
  status              text not null default 'active',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists growth_goals_brand_profile_id_idx on public.growth_goals(brand_profile_id);

drop trigger if exists trg_growth_goals_updated_at on public.growth_goals;
create trigger trg_growth_goals_updated_at before update on public.growth_goals
  for each row execute function public.set_updated_at();

-- ----- strategy_experiments ---------------------------------------------------
create table if not exists public.strategy_experiments (
  id                  uuid primary key default gen_random_uuid(),
  brand_profile_id    uuid not null references public.brand_profiles(id) on delete cascade,
  hypothesis          text not null,
  variable            text not null, -- reel_length, hook, caption_length, time, pillar, cta, language, frequency, photo_vs_video
  control_description text,
  variant_description text,
  status              text not null default 'proposed',
  start_date          date,
  end_date            date,
  result_summary      text,
  conclusion          text, -- keep, reject, inconclusive
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists strategy_experiments_brand_profile_id_idx on public.strategy_experiments(brand_profile_id);

drop trigger if exists trg_strategy_experiments_updated_at on public.strategy_experiments;
create trigger trg_strategy_experiments_updated_at before update on public.strategy_experiments
  for each row execute function public.set_updated_at();

-- ----- research_sources -------------------------------------------------------
create table if not exists public.research_sources (
  id                  uuid primary key default gen_random_uuid(),
  source_name         text not null,
  source_url          text,
  source_type         text not null default 'official_guidance', -- official_guidance, first_party_data, public_observation, third_party_recommendation, unverified_opinion
  platform            public.platform,
  summary             text,
  confidence          integer check (confidence >= 0 and confidence <= 100),
  review_date         date,
  expiry_date         date,
  recommended_action  text,
  tested              boolean not null default false,
  test_result         text,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists research_sources_platform_idx on public.research_sources(platform);

drop trigger if exists trg_research_sources_updated_at on public.research_sources;
create trigger trg_research_sources_updated_at before update on public.research_sources
  for each row execute function public.set_updated_at();

-- ----- research_findings ------------------------------------------------------
create table if not exists public.research_findings (
  id                  uuid primary key default gen_random_uuid(),
  brand_profile_id    uuid not null references public.brand_profiles(id) on delete cascade,
  source_id           uuid references public.research_sources(id) on delete set null,
  finding_type        text not null, -- trend, competitor_pattern, hashtag_performance, format_performance, timing, audience
  summary             text not null,
  confidence          integer check (confidence >= 0 and confidence <= 100),
  applied             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists research_findings_brand_profile_id_idx on public.research_findings(brand_profile_id);

drop trigger if exists trg_research_findings_updated_at on public.research_findings;
create trigger trg_research_findings_updated_at before update on public.research_findings
  for each row execute function public.set_updated_at();

-- ----- automation_rules -------------------------------------------------------
create table if not exists public.automation_rules (
  id                  uuid primary key default gen_random_uuid(),
  brand_profile_id    uuid references public.brand_profiles(id) on delete cascade,
  name                text not null,
  platform            public.platform,
  rule_type           text not null, -- schedule, approval_gate, content_curation, safety_block
  config              jsonb not null default '{}'::jsonb,
  is_active           boolean not null default true,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists automation_rules_brand_profile_id_idx on public.automation_rules(brand_profile_id);

drop trigger if exists trg_automation_rules_updated_at on public.automation_rules;
create trigger trg_automation_rules_updated_at before update on public.automation_rules
  for each row execute function public.set_updated_at();

-- ----- automation_runs --------------------------------------------------------
create table if not exists public.automation_runs (
  id                  uuid primary key default gen_random_uuid(),
  rule_id             uuid references public.automation_rules(id) on delete set null,
  brand_profile_id    uuid references public.brand_profiles(id) on delete cascade,
  run_type            text not null, -- daily_research, content_generation, publishing, metrics_sync, token_health, supply_check
  status              text not null default 'pending',
  started_at          timestamptz,
  completed_at        timestamptz,
  items_processed     integer not null default 0,
  items_failed        integer not null default 0,
  error_message       text,
  raw_logs            jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists automation_runs_brand_profile_id_idx on public.automation_runs(brand_profile_id);
create index if not exists automation_runs_status_idx on public.automation_runs(status);

drop trigger if exists trg_automation_runs_updated_at on public.automation_runs;
create trigger trg_automation_runs_updated_at before update on public.automation_runs
  for each row execute function public.set_updated_at();

-- ----- alerts -----------------------------------------------------------------
create table if not exists public.alerts (
  id                  uuid primary key default gen_random_uuid(),
  talent_id           uuid references public.talents(id) on delete cascade,
  brand_profile_id    uuid references public.brand_profiles(id) on delete cascade,
  social_account_id   uuid references public.social_accounts(id) on delete cascade,
  severity            public.alert_severity not null,
  alert_type          text not null,
  title               text not null,
  message             text,
  is_resolved         boolean not null default false,
  resolved_at         timestamptz,
  resolved_by         uuid references public.profiles(id) on delete set null,
  metadata            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists alerts_talent_id_idx on public.alerts(talent_id);
create index if not exists alerts_severity_idx on public.alerts(severity) where not is_resolved;

drop trigger if exists trg_alerts_updated_at on public.alerts;
create trigger trg_alerts_updated_at before update on public.alerts
  for each row execute function public.set_updated_at();

-- ----- prompt_templates & prompt_versions ------------------------------------
create table if not exists public.prompt_templates (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null unique,
  name                text not null,
  description         text,
  default_system_prompt text,
  default_user_template text,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists prompt_templates_code_idx on public.prompt_templates(code);

drop trigger if exists trg_prompt_templates_updated_at on public.prompt_templates;
create trigger trg_prompt_templates_updated_at before update on public.prompt_templates
  for each row execute function public.set_updated_at();

create table if not exists public.prompt_versions (
  id                  uuid primary key default gen_random_uuid(),
  prompt_template_id  uuid not null references public.prompt_templates(id) on delete cascade,
  version_number      integer not null,
  system_prompt       text,
  user_template       text,
  model_provider      text,
  model_name          text,
  change_notes        text,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  unique (prompt_template_id, version_number)
);

create index if not exists prompt_versions_prompt_template_id_idx on public.prompt_versions(prompt_template_id);

-- ----- ai_generations ---------------------------------------------------------
create table if not exists public.ai_generations (
  id                  uuid primary key default gen_random_uuid(),
  talent_id           uuid not null references public.talents(id) on delete cascade,
  brand_profile_id    uuid references public.brand_profiles(id) on delete set null,
  prompt_version_id   uuid references public.prompt_versions(id) on delete set null,
  platform            public.platform,
  content_type        public.content_type,
  objective           text,
  pillar              text,
  audience            text,
  language            text,
  input_data          jsonb not null default '{}'::jsonb,
  output              jsonb not null default '{}'::jsonb,
  media_reference_ids uuid[] not null default '{}',
  tags                text[],
  cta                 text,
  schedule            timestamptz,
  status              public.content_status not null default 'draft',
  risk_status         text,
  generation_source   text,
  model_provider      text,
  model_name          text,
  niches_used         text[],
  ai_guidance_used    text,
  daily_directive_used text,
  post_performance    jsonb,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists ai_generations_talent_id_idx on public.ai_generations(talent_id);

drop trigger if exists trg_ai_generations_updated_at on public.ai_generations;
create trigger trg_ai_generations_updated_at before update on public.ai_generations
  for each row execute function public.set_updated_at();

-- ----- integration_events -----------------------------------------------------
create table if not exists public.integration_events (
  id                  uuid primary key default gen_random_uuid(),
  platform            public.platform not null,
  event_type          text not null, -- oauth_callback, token_refresh, publish_attempt, metrics_sync, webhook
  social_account_id   uuid references public.social_accounts(id) on delete set null,
  status              text not null,
  payload             jsonb not null default '{}'::jsonb,
  error_message       text,
  created_at          timestamptz not null default now()
);

create index if not exists integration_events_social_account_id_idx on public.integration_events(social_account_id);

-- ----- audit_logs -------------------------------------------------------------
create table if not exists public.audit_logs (
  id                  uuid primary key default gen_random_uuid(),
  table_name          text not null,
  record_id           uuid,
  action              text not null, -- insert, update, delete, login, logout, export
  actor_profile_id    uuid references public.profiles(id) on delete set null,
  actor_role          text,
  old_values          jsonb,
  new_values          jsonb,
  ip_address          text,
  user_agent          text,
  created_at          timestamptz not null default now()
);

create index if not exists audit_logs_table_record_idx on public.audit_logs(table_name, record_id);
create index if not exists audit_logs_actor_idx on public.audit_logs(actor_profile_id);

-- ----- daily_ai_directives (per client, date, platform) ---------------------
create table if not exists public.daily_ai_directives (
  id                  uuid primary key default gen_random_uuid(),
  talent_id           uuid not null references public.talents(id) on delete cascade,
  brand_profile_id    uuid references public.brand_profiles(id) on delete cascade,
  platform            public.platform not null,
  directive_date      date not null,
  directive           text not null,
  author_profile_id   uuid references public.profiles(id) on delete set null,
  influenced_items    jsonb not null default '[]'::jsonb, -- list of ai_generation / content_item ids
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (talent_id, brand_profile_id, platform, directive_date)
);

create index if not exists daily_ai_directives_talent_id_idx on public.daily_ai_directives(talent_id);

drop trigger if exists trg_daily_ai_directives_updated_at on public.daily_ai_directives;
create trigger trg_daily_ai_directives_updated_at before update on public.daily_ai_directives
  for each row execute function public.set_updated_at();

-- ----- Feature flags / configuration ----------------------------------------
insert into public.app_settings (key, value) values
  ('brand_growth_enabled', 'true'::jsonb),
  ('feature_x_enabled', 'false'::jsonb),
  ('amplia_title', '"Amplia"'::jsonb),
  ('amplia_internal_name', '"Brand Growth"'::jsonb)
on conflict (key) do nothing;

-- ----- Row-Level Security -----------------------------------------------------

-- Helper: resolve brand_profile → talent
create or replace function public.talent_for_brand_profile(bp_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select talent_id from public.brand_profiles where id = bp_id
$$;

-- Helper: resolve social_account → talent
create or replace function public.talent_for_social_account(acc_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select talent_id from public.social_accounts where id = acc_id
$$;

grant execute on function
  public.talent_for_brand_profile(uuid),
  public.talent_for_social_account(uuid)
to authenticated;

-- Enable RLS on all new tables.
alter table public.talents                       enable row level security;
alter table public.service_types                 enable row level security;
alter table public.service_enrollments           enable row level security;
alter table public.talent_assignments            enable row level security;
alter table public.brand_profiles                enable row level security;
alter table public.brand_profile_versions        enable row level security;
alter table public.client_consents               enable row level security;
alter table public.client_boundaries             enable row level security;
alter table public.social_accounts               enable row level security;
alter table public.social_account_connections    enable row level security;
alter table public.social_account_tokens         enable row level security;
alter table public.social_account_status_history enable row level security;
alter table public.content_assets                enable row level security;
alter table public.asset_usage                   enable row level security;
alter table public.content_pillars               enable row level security;
alter table public.content_ideas                enable row level security;
alter table public.content_items                 enable row level security;
alter table public.content_versions              enable row level security;
alter table public.content_approvals             enable row level security;
alter table public.publishing_jobs               enable row level security;
alter table public.publishing_attempts           enable row level security;
alter table public.content_calendar_entries      enable row level security;
alter table public.platform_metrics              enable row level security;
alter table public.content_metrics               enable row level security;
alter table public.daily_account_metrics         enable row level security;
alter table public.growth_goals                  enable row level security;
alter table public.strategy_experiments          enable row level security;
alter table public.research_sources              enable row level security;
alter table public.research_findings             enable row level security;
alter table public.automation_rules              enable row level security;
alter table public.automation_runs               enable row level security;
alter table public.alerts                        enable row level security;
alter table public.prompt_templates              enable row level security;
alter table public.prompt_versions               enable row level security;
alter table public.ai_generations                enable row level security;
alter table public.integration_events            enable row level security;
alter table public.audit_logs                    enable row level security;
alter table public.daily_ai_directives           enable row level security;

-- Generic policy helpers that will be used repeatedly.
-- Using USING / WITH CHECK with brand-staff + owner-of-talent + assigned-to-talent.

-- talents
drop policy if exists talents_select on public.talents;
create policy talents_select on public.talents for select to authenticated
  using ( public.can_manage_brand_talent(id) or public.is_assigned_to_talent(id) );

drop policy if exists talents_insert on public.talents;
create policy talents_insert on public.talents for insert to authenticated
  with check ( public.is_brand_staff() );

drop policy if exists talents_update on public.talents;
create policy talents_update on public.talents for update to authenticated
  using ( public.is_brand_editor() or public.can_manage_brand_talent(id) )
  with check ( public.is_brand_editor() or public.can_manage_brand_talent(id) );

drop policy if exists talents_delete on public.talents;
create policy talents_delete on public.talents for delete to authenticated
  using ( public.is_owner() );

-- service_types (read active; write owner/admin only)
drop policy if exists service_types_select on public.service_types;
create policy service_types_select on public.service_types for select to authenticated
  using ( active = true or public.is_staff() );

drop policy if exists service_types_write on public.service_types;
create policy service_types_write on public.service_types for all to authenticated
  using ( public.is_staff() ) with check ( public.is_staff() );

-- service_enrollments
drop policy if exists service_enrollments_select on public.service_enrollments;
create policy service_enrollments_select on public.service_enrollments for select to authenticated
  using ( public.can_manage_brand_talent(talent_id) or public.is_assigned_to_talent(talent_id) );

drop policy if exists service_enrollments_write on public.service_enrollments;
create policy service_enrollments_write on public.service_enrollments for all to authenticated
  using ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) )
  with check ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) );

-- talent_assignments (staff only)
drop policy if exists talent_assignments_select on public.talent_assignments;
create policy talent_assignments_select on public.talent_assignments for select to authenticated
  using ( public.is_brand_staff() );

drop policy if exists talent_assignments_write on public.talent_assignments;
create policy talent_assignments_write on public.talent_assignments for all to authenticated
  using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

-- brand_profiles
drop policy if exists brand_profiles_select on public.brand_profiles;
create policy brand_profiles_select on public.brand_profiles for select to authenticated
  using ( public.can_manage_brand_talent(talent_id) or public.is_assigned_to_talent(talent_id) );

drop policy if exists brand_profiles_write on public.brand_profiles;
create policy brand_profiles_write on public.brand_profiles for all to authenticated
  using ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) )
  with check ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) );

-- brand_profile_versions (audit: readable by staff + assigned)
drop policy if exists brand_profile_versions_select on public.brand_profile_versions;
create policy brand_profile_versions_select on public.brand_profile_versions for select to authenticated
  using ( public.can_manage_brand_talent(public.talent_for_brand_profile(brand_profile_id)) or public.is_assigned_to_talent(public.talent_for_brand_profile(brand_profile_id)) );

drop policy if exists brand_profile_versions_write on public.brand_profile_versions;
create policy brand_profile_versions_write on public.brand_profile_versions for all to authenticated
  using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

-- client_consents (read by talent + staff; write by staff)
drop policy if exists client_consents_select on public.client_consents;
create policy client_consents_select on public.client_consents for select to authenticated
  using ( public.can_manage_brand_talent(talent_id) or public.is_assigned_to_talent(talent_id) );

drop policy if exists client_consents_write on public.client_consents;
create policy client_consents_write on public.client_consents for all to authenticated
  using ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) )
  with check ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) );

-- client_boundaries
drop policy if exists client_boundaries_select on public.client_boundaries;
create policy client_boundaries_select on public.client_boundaries for select to authenticated
  using ( public.can_manage_brand_talent(talent_id) or public.is_assigned_to_talent(talent_id) );

drop policy if exists client_boundaries_write on public.client_boundaries;
create policy client_boundaries_write on public.client_boundaries for all to authenticated
  using ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) )
  with check ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) );

-- social_accounts (read by talent + staff; write by staff)
drop policy if exists social_accounts_select on public.social_accounts;
create policy social_accounts_select on public.social_accounts for select to authenticated
  using ( public.can_manage_brand_talent(talent_id) or public.is_assigned_to_talent(talent_id) );

drop policy if exists social_accounts_write on public.social_accounts;
create policy social_accounts_write on public.social_accounts for all to authenticated
  using ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) )
  with check ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) );

-- social_account_connections (staff only; tokens separate)
drop policy if exists social_account_connections_select on public.social_account_connections;
create policy social_account_connections_select on public.social_account_connections for select to authenticated
  using ( public.is_brand_staff() );

drop policy if exists social_account_connections_write on public.social_account_connections;
create policy social_account_connections_write on public.social_account_connections for all to authenticated
  using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

-- social_account_tokens (staff only, never exposed to clients)
drop policy if exists social_account_tokens_select on public.social_account_tokens;
create policy social_account_tokens_select on public.social_account_tokens for select to authenticated
  using ( public.is_brand_staff() );

drop policy if exists social_account_tokens_write on public.social_account_tokens;
create policy social_account_tokens_write on public.social_account_tokens for all to authenticated
  using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

-- social_account_status_history
drop policy if exists social_account_status_history_select on public.social_account_status_history;
create policy social_account_status_history_select on public.social_account_status_history for select to authenticated
  using ( public.can_manage_brand_talent(public.talent_for_social_account(social_account_id)) or public.is_assigned_to_talent(public.talent_for_social_account(social_account_id)) );

drop policy if exists social_account_status_history_write on public.social_account_status_history;
create policy social_account_status_history_write on public.social_account_status_history for all to authenticated
  using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

-- content_assets (read by talent + staff; write by staff/talent for own uploads)
drop policy if exists content_assets_select on public.content_assets;
create policy content_assets_select on public.content_assets for select to authenticated
  using ( public.can_manage_brand_talent(talent_id) or public.is_assigned_to_talent(talent_id) );

drop policy if exists content_assets_write on public.content_assets;
create policy content_assets_write on public.content_assets for all to authenticated
  using ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) )
  with check ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) );

-- content_pillars
drop policy if exists content_pillars_select on public.content_pillars;
create policy content_pillars_select on public.content_pillars for select to authenticated
  using ( public.can_manage_brand_talent(public.talent_for_brand_profile(brand_profile_id)) or public.is_assigned_to_talent(public.talent_for_brand_profile(brand_profile_id)) );

drop policy if exists content_pillars_write on public.content_pillars;
create policy content_pillars_write on public.content_pillars for all to authenticated
  using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

-- content_ideas
drop policy if exists content_ideas_select on public.content_ideas;
create policy content_ideas_select on public.content_ideas for select to authenticated
  using ( public.can_manage_brand_talent(public.talent_for_brand_profile(brand_profile_id)) or public.is_assigned_to_talent(public.talent_for_brand_profile(brand_profile_id)) );

drop policy if exists content_ideas_write on public.content_ideas;
create policy content_ideas_write on public.content_ideas for all to authenticated
  using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

-- content_items
drop policy if exists content_items_select on public.content_items;
create policy content_items_select on public.content_items for select to authenticated
  using ( public.can_manage_brand_talent(talent_id) or public.is_assigned_to_talent(talent_id) );

drop policy if exists content_items_write on public.content_items;
create policy content_items_write on public.content_items for all to authenticated
  using ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) )
  with check ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) );

-- publishing_jobs
drop policy if exists publishing_jobs_select on public.publishing_jobs;
create policy publishing_jobs_select on public.publishing_jobs for select to authenticated
  using ( public.is_brand_staff() or public.is_assigned_to_talent(public.talent_for_social_account(social_account_id)) );

drop policy if exists publishing_jobs_write on public.publishing_jobs;
create policy publishing_jobs_write on public.publishing_jobs for all to authenticated
  using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

-- prompts / ai_generations / integration_events / audit_logs / alerts / metrics / experiments / research / automation
drop policy if exists prompts_select on public.prompt_templates;
create policy prompts_select on public.prompt_templates for select to authenticated using ( is_active = true or public.is_brand_staff() );
drop policy if exists prompts_write on public.prompt_templates;
create policy prompts_write on public.prompt_templates for all to authenticated using ( public.is_brand_staff() ) with check ( public.is_brand_staff() );

drop policy if exists prompt_versions_select on public.prompt_versions;
create policy prompt_versions_select on public.prompt_versions for select to authenticated using ( public.is_brand_staff() );
drop policy if exists prompt_versions_write on public.prompt_versions;
create policy prompt_versions_write on public.prompt_versions for all to authenticated using ( public.is_brand_staff() ) with check ( public.is_brand_staff() );

drop policy if exists ai_generations_select on public.ai_generations;
create policy ai_generations_select on public.ai_generations for select to authenticated
  using ( public.can_manage_brand_talent(talent_id) or public.is_assigned_to_talent(talent_id) );
drop policy if exists ai_generations_write on public.ai_generations;
create policy ai_generations_write on public.ai_generations for all to authenticated
  using ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) )
  with check ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) );

drop policy if exists integration_events_select on public.integration_events;
create policy integration_events_select on public.integration_events for select to authenticated using ( public.is_brand_staff() );
drop policy if exists integration_events_write on public.integration_events;
create policy integration_events_write on public.integration_events for all to authenticated using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated using ( public.is_brand_staff() );
drop policy if exists audit_logs_write on public.audit_logs;
create policy audit_logs_write on public.audit_logs for all to authenticated using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

drop policy if exists alerts_select on public.alerts;
create policy alerts_select on public.alerts for select to authenticated
  using ( public.can_manage_brand_talent(talent_id) or public.is_assigned_to_talent(talent_id) );
drop policy if exists alerts_write on public.alerts;
create policy alerts_write on public.alerts for all to authenticated
  using ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) )
  with check ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) );

-- Remaining tables with brand_profile or talent linkage get a generic staff+assigned rule.
-- For brevity these mirror the content_pillars / content_items patterns.

-- content_versions
drop policy if exists content_versions_select on public.content_versions;
create policy content_versions_select on public.content_versions for select to authenticated using ( public.is_brand_staff() );
drop policy if exists content_versions_write on public.content_versions;
create policy content_versions_write on public.content_versions for all to authenticated using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

-- content_approvals
drop policy if exists content_approvals_select on public.content_approvals;
create policy content_approvals_select on public.content_approvals for select to authenticated using ( public.is_brand_staff() );
drop policy if exists content_approvals_write on public.content_approvals;
create policy content_approvals_write on public.content_approvals for all to authenticated using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

-- asset_usage
drop policy if exists asset_usage_select on public.asset_usage;
create policy asset_usage_select on public.asset_usage for select to authenticated using ( public.is_brand_staff() );
drop policy if exists asset_usage_write on public.asset_usage;
create policy asset_usage_write on public.asset_usage for all to authenticated using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

-- publishing_attempts
drop policy if exists publishing_attempts_select on public.publishing_attempts;
create policy publishing_attempts_select on public.publishing_attempts for select to authenticated using ( public.is_brand_staff() );
drop policy if exists publishing_attempts_write on public.publishing_attempts;
create policy publishing_attempts_write on public.publishing_attempts for all to authenticated using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

-- content_calendar_entries
drop policy if exists content_calendar_entries_select on public.content_calendar_entries;
create policy content_calendar_entries_select on public.content_calendar_entries for select to authenticated
  using ( public.can_manage_brand_talent(talent_id) or public.is_assigned_to_talent(talent_id) );
drop policy if exists content_calendar_entries_write on public.content_calendar_entries;
create policy content_calendar_entries_write on public.content_calendar_entries for all to authenticated
  using ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) )
  with check ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) );

-- platform_metrics, content_metrics, daily_account_metrics
drop policy if exists platform_metrics_select on public.platform_metrics;
create policy platform_metrics_select on public.platform_metrics for select to authenticated using ( public.is_brand_staff() );
drop policy if exists platform_metrics_write on public.platform_metrics;
create policy platform_metrics_write on public.platform_metrics for all to authenticated using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

drop policy if exists content_metrics_select on public.content_metrics;
create policy content_metrics_select on public.content_metrics for select to authenticated using ( public.is_brand_staff() );
drop policy if exists content_metrics_write on public.content_metrics;
create policy content_metrics_write on public.content_metrics for all to authenticated using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

drop policy if exists daily_account_metrics_select on public.daily_account_metrics;
create policy daily_account_metrics_select on public.daily_account_metrics for select to authenticated using ( public.is_brand_staff() );
drop policy if exists daily_account_metrics_write on public.daily_account_metrics;
create policy daily_account_metrics_write on public.daily_account_metrics for all to authenticated using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

-- growth_goals, strategy_experiments, research_sources, research_findings, automation_rules, automation_runs, daily_ai_directives
drop policy if exists growth_goals_select on public.growth_goals;
create policy growth_goals_select on public.growth_goals for select to authenticated
  using ( public.can_manage_brand_talent(public.talent_for_brand_profile(brand_profile_id)) or public.is_assigned_to_talent(public.talent_for_brand_profile(brand_profile_id)) );
drop policy if exists growth_goals_write on public.growth_goals;
create policy growth_goals_write on public.growth_goals for all to authenticated using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

drop policy if exists strategy_experiments_select on public.strategy_experiments;
create policy strategy_experiments_select on public.strategy_experiments for select to authenticated using ( public.is_brand_staff() );
drop policy if exists strategy_experiments_write on public.strategy_experiments;
create policy strategy_experiments_write on public.strategy_experiments for all to authenticated using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

drop policy if exists research_sources_select on public.research_sources;
create policy research_sources_select on public.research_sources for select to authenticated using ( public.is_brand_staff() );
drop policy if exists research_sources_write on public.research_sources;
create policy research_sources_write on public.research_sources for all to authenticated using ( public.is_brand_staff() ) with check ( public.is_brand_staff() );

drop policy if exists research_findings_select on public.research_findings;
create policy research_findings_select on public.research_findings for select to authenticated using ( public.is_brand_staff() );
drop policy if exists research_findings_write on public.research_findings;
create policy research_findings_write on public.research_findings for all to authenticated using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

drop policy if exists automation_rules_select on public.automation_rules;
create policy automation_rules_select on public.automation_rules for select to authenticated using ( public.is_brand_staff() );
drop policy if exists automation_rules_write on public.automation_rules;
create policy automation_rules_write on public.automation_rules for all to authenticated using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

drop policy if exists automation_runs_select on public.automation_runs;
create policy automation_runs_select on public.automation_runs for select to authenticated using ( public.is_brand_staff() );
drop policy if exists automation_runs_write on public.automation_runs;
create policy automation_runs_write on public.automation_runs for all to authenticated using ( public.is_brand_editor() ) with check ( public.is_brand_editor() );

drop policy if exists daily_ai_directives_select on public.daily_ai_directives;
create policy daily_ai_directives_select on public.daily_ai_directives for select to authenticated
  using ( public.can_manage_brand_talent(talent_id) or public.is_assigned_to_talent(talent_id) );
drop policy if exists daily_ai_directives_write on public.daily_ai_directives;
create policy daily_ai_directives_write on public.daily_ai_directives for all to authenticated
  using ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) )
  with check ( public.is_brand_editor() or public.can_manage_brand_talent(talent_id) );

-- Storage: brand-assets bucket (private)
insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', false) on conflict (id) do nothing;

drop policy if exists storage_brand_assets_all on storage.objects;
create policy storage_brand_assets_all on storage.objects for all to authenticated
  using ( bucket_id = 'brand-assets' and public.is_brand_staff() )
  with check ( bucket_id = 'brand-assets' and public.is_brand_staff() );


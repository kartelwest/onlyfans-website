-- =============================================================================
-- KARAY Models — Video editor core schema
-- Tables, enums, indexes, and RLS for the automated video processing system.
-- =============================================================================

-- ----- Enums -----------------------------------------------------------------
do $$ begin
  create type public.video_job_status as enum (
    'new', 'awaiting_configuration', 'awaiting_approval', 'queued',
    'downloading', 'preparing', 'processing', 'rendering_captions',
    'rendering', 'sending', 'completed', 'failed', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.video_source_type as enum ('manual_upload', 'google_drive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.video_platform as enum (
    'instagram_reels', 'instagram_stories', 'tiktok', 'youtube_shorts',
    'x', 'reddit', 'onlyfans', 'fansly', 'custom'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.video_aspect as enum (
    'vertical_9_16', 'square_1_1', 'portrait_4_5', 'landscape_16_9', 'original'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.video_brand_asset_type as enum (
    'logo', 'intro', 'outro', 'music', 'voiceover', 'font', 'overlay'
  );
exception when duplicate_object then null; end $$;

-- ----- Shared updated_at trigger already exists (set_updated_at) -------------

-- Helper: ensure staff predicate exists for RLS below. Re-creating is safe because
-- it only depends on public.profiles, which exists in every KarayModels project.
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select active and role in ('owner','administrator')
    from public.profiles where id = auth.uid()), false)
$$;

-- ----- video_integrations: connected Google Drive / cloud accounts -----------
create table if not exists public.video_integrations (
  id                    uuid primary key default gen_random_uuid(),
  provider              text not null default 'google_drive',
  owner_id              uuid references public.profiles(id) on delete set null,
  account_identifier    text,
  credentials_encrypted text not null,
  scopes                text[] default array[]::text[],
  expires_at            timestamptz,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists video_integrations_owner_idx on public.video_integrations(owner_id);

drop trigger if exists trg_video_integrations_updated_at on public.video_integrations;
create trigger trg_video_integrations_updated_at before update on public.video_integrations
  for each row execute function public.set_updated_at();

-- ----- video_source_folders: Drive folders linked to models ------------------
create table if not exists public.video_source_folders (
  id                    uuid primary key default gen_random_uuid(),
  integration_id        uuid references public.video_integrations(id) on delete set null,
  model_id              uuid not null references public.models(id) on delete cascade,
  platform              public.video_platform not null default 'custom',
  folder_id             text not null,
  folder_url            text,
  label                 text,
  template_id           uuid,
  auto_process          boolean not null default false,
  requires_approval     boolean not null default true,
  last_sync_at          timestamptz,
  drive_page_token      text,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists video_source_folders_model_idx on public.video_source_folders(model_id);
create index if not exists video_source_folders_integration_idx on public.video_source_folders(integration_id);

drop trigger if exists trg_video_source_folders_updated_at on public.video_source_folders;
create trigger trg_video_source_folders_updated_at before update on public.video_source_folders
  for each row execute function public.set_updated_at();

-- ----- video_assets: each source file (manual or Drive) ------------------------
create table if not exists public.video_assets (
  id                    uuid primary key default gen_random_uuid(),
  model_id              uuid not null references public.models(id) on delete cascade,
  source_type           public.video_source_type not null,
  folder_id             uuid references public.video_source_folders(id) on delete set null,
  original_filename     text not null,
  storage_path          text,
  drive_file_id         text,
  drive_file_url        text,
  mime_type             text,
  file_size_bytes       bigint,
  duration_seconds      numeric(10,2),
  width                 integer,
  height                integer,
  file_hash             text,
  metadata              jsonb default '{}'::jsonb,
  status                text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'archived')),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists video_assets_model_idx on public.video_assets(model_id);
create index if not exists video_assets_drive_file_idx on public.video_assets(drive_file_id);
create index if not exists video_assets_hash_idx on public.video_assets(file_hash);

drop trigger if exists trg_video_assets_updated_at on public.video_assets;
create trigger trg_video_assets_updated_at before update on public.video_assets
  for each row execute function public.set_updated_at();

-- ----- video_templates: editing templates ------------------------------------
create table if not exists public.video_templates (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  description           text,
  target_platform       public.video_platform not null default 'custom',
  aspect                public.video_aspect not null default 'original',
  resolution_width      integer,
  resolution_height     integer,
  max_duration_seconds  integer,
  settings              jsonb not null default '{}'::jsonb,
  is_active             boolean not null default true,
  is_global             boolean not null default true,
  model_id              uuid references public.models(id) on delete set null,
  folder_id             uuid references public.video_source_folders(id) on delete set null,
  created_by            uuid references public.profiles(id) on delete set null,
  version               integer not null default 1,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists video_templates_model_idx on public.video_templates(model_id);
create index if not exists video_templates_folder_idx on public.video_templates(folder_id);

drop trigger if exists trg_video_templates_updated_at on public.video_templates;
create trigger trg_video_templates_updated_at before update on public.video_templates
  for each row execute function public.set_updated_at();

-- ----- video_template_versions: change history -------------------------------
create table if not exists public.video_template_versions (
  id                    uuid primary key default gen_random_uuid(),
  template_id           uuid not null references public.video_templates(id) on delete cascade,
  version               integer not null,
  settings              jsonb not null,
  changed_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now()
);
create unique index if not exists video_template_versions_template_version_idx
  on public.video_template_versions(template_id, version);

-- ----- video_brand_assets: logos, intros, music, fonts -----------------------
create table if not exists public.video_brand_assets (
  id                    uuid primary key default gen_random_uuid(),
  type                  public.video_brand_asset_type not null,
  name                  text not null,
  storage_path          text not null,
  usage_license         text,
  is_active             boolean not null default true,
  metadata              jsonb default '{}'::jsonb,
  created_by            uuid references public.profiles(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists trg_video_brand_assets_updated_at on public.video_brand_assets;
create trigger trg_video_brand_assets_updated_at before update on public.video_brand_assets
  for each row execute function public.set_updated_at();

-- ----- video_jobs: processing queue ------------------------------------------
create table if not exists public.video_jobs (
  id                    uuid primary key default gen_random_uuid(),
  asset_id              uuid not null references public.video_assets(id) on delete cascade,
  template_id           uuid references public.video_templates(id) on delete set null,
  instruction_id        uuid,
  created_by            uuid references public.profiles(id) on delete set null,
  status                public.video_job_status not null default 'new',
  progress              integer not null default 0 check (progress between 0 and 100),
  retry_count           integer not null default 0,
  cost_estimate         numeric(12,4) default 0,
  cost_actual           numeric(12,4) default 0,
  started_at            timestamptz,
  finished_at           timestamptz,
  error_message         text,
  processing_metadata   jsonb default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists video_jobs_asset_idx on public.video_jobs(asset_id);
create index if not exists video_jobs_status_idx on public.video_jobs(status, created_at);
create index if not exists video_jobs_created_idx on public.video_jobs(created_at desc);

drop trigger if exists trg_video_jobs_updated_at on public.video_jobs;
create trigger trg_video_jobs_updated_at before update on public.video_jobs
  for each row execute function public.set_updated_at();

-- ----- video_job_outputs: rendered outputs per platform ----------------------
create table if not exists public.video_job_outputs (
  id                    uuid primary key default gen_random_uuid(),
  job_id                uuid not null references public.video_jobs(id) on delete cascade,
  platform              public.video_platform not null,
  resolution_width      integer,
  resolution_height     integer,
  file_path             text not null,
  drive_file_id         text,
  file_size_bytes       bigint,
  duration_seconds      numeric(10,2),
  is_approved           boolean,
  approved_by           uuid references public.profiles(id) on delete set null,
  approved_at           timestamptz,
  created_at            timestamptz not null default now()
);
create index if not exists video_job_outputs_job_idx on public.video_job_outputs(job_id);

-- ----- video_instructions: natural language + structured interpretation -------
create table if not exists public.video_instructions (
  id                    uuid primary key default gen_random_uuid(),
  job_id                uuid not null references public.video_jobs(id) on delete cascade,
  raw_text              text not null,
  parsed_json           jsonb,
  approved_by           uuid references public.profiles(id) on delete set null,
  approved_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists trg_video_instructions_updated_at on public.video_instructions;
create trigger trg_video_instructions_updated_at before update on public.video_instructions
  for each row execute function public.set_updated_at();

-- ----- video_processing_logs: structured audit logs --------------------------
create table if not exists public.video_processing_logs (
  id                    uuid primary key default gen_random_uuid(),
  job_id                uuid references public.video_jobs(id) on delete cascade,
  level                 text not null check (level in ('debug', 'info', 'warning', 'error')),
  message               text not null,
  metadata              jsonb default '{}'::jsonb,
  created_at            timestamptz not null default now()
);
create index if not exists video_processing_logs_job_idx on public.video_processing_logs(job_id, created_at desc);

-- ----- video_processing_errors: failure records --------------------------------
create table if not exists public.video_processing_errors (
  id                    uuid primary key default gen_random_uuid(),
  job_id                uuid references public.video_jobs(id) on delete cascade,
  error_code            text,
  message               text not null,
  retryable             boolean not null default true,
  created_at            timestamptz not null default now()
);
create index if not exists video_processing_errors_job_idx on public.video_processing_errors(job_id);

-- ----- video_approvals: approval audit ----------------------------------------
create table if not exists public.video_approvals (
  id                    uuid primary key default gen_random_uuid(),
  job_id                uuid not null references public.video_jobs(id) on delete cascade,
  approved_by           uuid not null references public.profiles(id) on delete set null,
  decision              text not null check (decision in ('approved', 'rejected')),
  notes                 text,
  created_at            timestamptz not null default now()
);

-- ----- video_usage: cost and usage limits ------------------------------------
create table if not exists public.video_usage (
  id                    uuid primary key default gen_random_uuid(),
  model_id              uuid references public.models(id) on delete cascade,
  month                 text not null,
  storage_bytes         bigint not null default 0,
  transcode_seconds     numeric(12,2) not null default 0,
  estimated_cost        numeric(12,4) not null default 0,
  actual_cost           numeric(12,4) not null default 0,
  currency              text not null default 'USD',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create unique index if not exists video_usage_model_month_idx
  on public.video_usage(model_id, month, currency);

drop trigger if exists trg_video_usage_updated_at on public.video_usage;
create trigger trg_video_usage_updated_at before update on public.video_usage
  for each row execute function public.set_updated_at();

-- ----- video_notifications: dashboard notifications --------------------------
create table if not exists public.video_notifications (
  id                    uuid primary key default gen_random_uuid(),
  recipient_id          uuid not null references public.profiles(id) on delete cascade,
  type                  text not null,
  message               text not null,
  link                  text,
  read                  boolean not null default false,
  created_at            timestamptz not null default now()
);
create index if not exists video_notifications_recipient_idx on public.video_notifications(recipient_id, read, created_at desc);

-- =============================================================================
-- Row-Level Security
-- owner: full access. administrator: full except destructive owner-only ops.
-- representative: no access by default. model: own approved records only.
-- =============================================================================

alter table public.video_integrations        enable row level security;
alter table public.video_source_folders      enable row level security;
alter table public.video_assets              enable row level security;
alter table public.video_templates           enable row level security;
alter table public.video_template_versions   enable row level security;
alter table public.video_brand_assets        enable row level security;
alter table public.video_jobs                enable row level security;
alter table public.video_job_outputs         enable row level security;
alter table public.video_instructions        enable row level security;
alter table public.video_processing_logs     enable row level security;
alter table public.video_processing_errors    enable row level security;
alter table public.video_approvals           enable row level security;
alter table public.video_usage               enable row level security;
alter table public.video_notifications       enable row level security;

-- Helper: can a user read a job? (staff, or the model's own approved jobs)
create or replace function public.can_read_video_job(target_job uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
    or exists (
      select 1 from public.video_jobs j
      join public.video_assets a on a.id = j.asset_id
      where j.id = target_job
        and a.model_id in (select id from public.models where profile_id = auth.uid())
        and j.status = 'completed'
    )
$$;

create or replace function public.can_read_video_asset(target_asset uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
    or exists (
      select 1 from public.video_assets a
      where a.id = target_asset
        and a.model_id in (select id from public.models where profile_id = auth.uid())
    )
$$;

create or replace function public.can_read_video_template_version(target_version uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
    or exists (
      select 1
      from public.video_template_versions v
      join public.video_templates t on t.id = v.template_id
      where v.id = target_version
        and (t.is_global = true or t.model_id in (select id from public.models where profile_id = auth.uid()))
    )
$$;

create or replace function public.can_read_video_job_output(target_output uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
    or exists (
      select 1
      from public.video_job_outputs o
      join public.video_jobs j on j.id = o.job_id
      join public.video_assets a on a.id = j.asset_id
      where o.id = target_output
        and a.model_id in (select id from public.models where profile_id = auth.uid())
        and j.status = 'completed'
    )
$$;

-- video_integrations: staff only
drop policy if exists video_integrations_all on public.video_integrations;
create policy video_integrations_all on public.video_integrations for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- video_source_folders: staff read/write; model read own
drop policy if exists video_source_folders_select on public.video_source_folders;
create policy video_source_folders_select on public.video_source_folders for select to authenticated
  using (public.is_staff() or model_id in (select id from public.models where profile_id = auth.uid()));

drop policy if exists video_source_folders_write on public.video_source_folders;
create policy video_source_folders_write on public.video_source_folders for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- video_assets: staff read/write; model read own
drop policy if exists video_assets_select on public.video_assets;
create policy video_assets_select on public.video_assets for select to authenticated
  using (public.is_staff() or public.can_read_video_asset(id));

drop policy if exists video_assets_write on public.video_assets;
create policy video_assets_write on public.video_assets for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- video_templates: staff read/write; model read own assigned templates
drop policy if exists video_templates_select on public.video_templates;
create policy video_templates_select on public.video_templates for select to authenticated
  using (
    public.is_staff()
    or is_global = true
    or model_id in (select id from public.models where profile_id = auth.uid())
  );

drop policy if exists video_templates_write on public.video_templates;
create policy video_templates_write on public.video_templates for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- video_template_versions: staff read; model read own
drop policy if exists video_template_versions_select on public.video_template_versions;
create policy video_template_versions_select on public.video_template_versions for select to authenticated
  using (public.is_staff() or public.can_read_video_template_version(id));

-- video_brand_assets: staff all
drop policy if exists video_brand_assets_all on public.video_brand_assets;
create policy video_brand_assets_all on public.video_brand_assets for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- video_jobs: staff all; model read own completed
drop policy if exists video_jobs_select on public.video_jobs;
create policy video_jobs_select on public.video_jobs for select to authenticated
  using (public.is_staff() or public.can_read_video_job(id));

drop policy if exists video_jobs_write on public.video_jobs;
create policy video_jobs_write on public.video_jobs for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- video_job_outputs: staff all; model read own completed
drop policy if exists video_job_outputs_select on public.video_job_outputs;
create policy video_job_outputs_select on public.video_job_outputs for select to authenticated
  using (public.is_staff() or public.can_read_video_job_output(id));

-- video_instructions: staff all
drop policy if exists video_instructions_all on public.video_instructions;
create policy video_instructions_all on public.video_instructions for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Logs and errors: staff all
drop policy if exists video_processing_logs_all on public.video_processing_logs;
create policy video_processing_logs_all on public.video_processing_logs for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists video_processing_errors_all on public.video_processing_errors;
create policy video_processing_errors_all on public.video_processing_errors for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- video_approvals: staff all
drop policy if exists video_approvals_all on public.video_approvals;
create policy video_approvals_all on public.video_approvals for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- video_usage: staff all
drop policy if exists video_usage_all on public.video_usage;
create policy video_usage_all on public.video_usage for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- video_notifications: owner/admin all; model own
drop policy if exists video_notifications_select on public.video_notifications;
create policy video_notifications_select on public.video_notifications for select to authenticated
  using (public.is_staff() or recipient_id = auth.uid());

drop policy if exists video_notifications_write on public.video_notifications;
create policy video_notifications_write on public.video_notifications for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ----- Storage buckets -------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('video-originals', 'video-originals', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('video-edited', 'video-edited', false)
on conflict (id) do nothing;

-- Storage policies: staff only for now; signed URLs served by API
drop policy if exists storage_video_originals_all on storage.objects;
create policy storage_video_originals_all on storage.objects for all to authenticated
  using (bucket_id = 'video-originals' and public.is_staff())
  with check (bucket_id = 'video-originals' and public.is_staff());

drop policy if exists storage_video_edited_all on storage.objects;
create policy storage_video_edited_all on storage.objects for all to authenticated
  using (bucket_id = 'video-edited' and public.is_staff())
  with check (bucket_id = 'video-edited' and public.is_staff());

-- Grant helpers to authenticated role for use in RLS and storage policies
grant execute on function
  public.can_read_video_job(uuid),
  public.can_read_video_asset(uuid),
  public.can_read_video_template_version(uuid),
  public.can_read_video_job_output(uuid)
to authenticated;

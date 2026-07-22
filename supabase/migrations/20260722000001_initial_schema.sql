-- =============================================================================
-- KARRAY Models — Initial schema (run first)
-- =============================================================================
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ----- Enums -----------------------------------------------------------------
do $$ begin
  create type public.management_role as enum
    ('owner', 'administrator', 'representative', 'model');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.checklist_status as enum
    ('not_started','planned','in_progress','completed',
     'missing','inactive','duplicate','blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.responsibility as enum ('model','agency','both');
exception when duplicate_object then null; end $$;

-- ----- Shared updated_at trigger ---------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ----- profiles (1:1 with auth.users) ----------------------------------------
create table if not exists public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  full_name             text,
  role                  public.management_role not null default 'model',
  active                boolean not null default true,
  must_change_password  boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_active_idx on public.profiles(active);
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----- models ----------------------------------------------------------------
create table if not exists public.models (
  id                       uuid primary key default gen_random_uuid(),
  profile_id               uuid unique references public.profiles(id) on delete set null,
  representative_id        uuid references public.profiles(id) on delete set null,
  created_by               uuid references public.profiles(id) on delete set null,
  model_number             integer,
  slug                     text not null unique,
  display_name             text not null,
  stage_name               text,
  birthday                 date,
  email                    text,
  whatsapp                 text,
  nationality              text,
  city                     text,
  language                 text,
  instagram                text,
  twitter                  text,
  reddit                   text,
  tiktok                   text,
  youtube                  text,
  facebook                 text,
  onlyfans                 text,
  fansly                   text,
  drive_onlyfans           text,
  drive_instagram          text,
  drive_twitter            text,
  content_drive_url        text,   -- backs the model "content" button (owner/admin set only)
  status                   text default 'active',
  active                   boolean not null default true,
  website_login_enabled    boolean not null default false,
  onboarding_percentage    integer not null default 0 check (onboarding_percentage between 0 and 100),
  onboarding_complete      boolean not null default false,
  profile_photo_url        text,
  latest_note_summary      text,
  last_login_at            timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists models_profile_id_idx on public.models(profile_id);
create index if not exists models_representative_id_idx on public.models(representative_id);
create index if not exists models_active_idx on public.models(active);
drop trigger if exists trg_models_updated_at on public.models;
create trigger trg_models_updated_at before update on public.models
  for each row execute function public.set_updated_at();

-- ----- model_checklist (1:1 with models) -------------------------------------
create table if not exists public.model_checklist (
  model_id                       uuid primary key references public.models(id) on delete cascade,
  onlyfans_status                public.checklist_status not null default 'not_started',
  fansly_status                  public.checklist_status not null default 'not_started',
  instagram_status               public.checklist_status not null default 'not_started',
  twitter_status                 public.checklist_status not null default 'not_started',
  reddit_status                  public.checklist_status not null default 'not_started',
  tiktok_status                  public.checklist_status not null default 'not_started',
  youtube_status                 public.checklist_status not null default 'not_started',
  facebook_status                public.checklist_status not null default 'not_started',
  google_drive_status            public.checklist_status not null default 'not_started',
  website_login_status           public.checklist_status not null default 'not_started',
  contract_status                public.checklist_status not null default 'not_started',
  model_release_status           public.checklist_status not null default 'not_started',
  identity_document_status       public.checklist_status not null default 'not_started',
  cpf_status                     public.checklist_status not null default 'not_started',
  pix_status                     public.checklist_status not null default 'not_started',
  bank_account_status            public.checklist_status not null default 'not_started',
  onlyfans_verification_status   public.checklist_status not null default 'not_started',
  fansly_verification_status     public.checklist_status not null default 'not_started',
  welcome_call_status            public.checklist_status not null default 'not_started',
  content_received_status        public.checklist_status not null default 'not_started',
  onboarding_percentage          integer not null default 0 check (onboarding_percentage between 0 and 100),
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now()
);
drop trigger if exists trg_model_checklist_updated_at on public.model_checklist;
create trigger trg_model_checklist_updated_at before update on public.model_checklist
  for each row execute function public.set_updated_at();

-- ----- model_platforms -------------------------------------------------------
create table if not exists public.model_platforms (
  id             uuid primary key default gen_random_uuid(),
  model_id       uuid not null references public.models(id) on delete cascade,
  platform_name  text not null,
  username       text,
  profile_url    text,
  status         public.checklist_status not null default 'not_started',
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists model_platforms_model_id_idx on public.model_platforms(model_id);
drop trigger if exists trg_model_platforms_updated_at on public.model_platforms;
create trigger trg_model_platforms_updated_at before update on public.model_platforms
  for each row execute function public.set_updated_at();

-- ----- model_drive_folders ---------------------------------------------------
create table if not exists public.model_drive_folders (
  id           uuid primary key default gen_random_uuid(),
  model_id     uuid not null references public.models(id) on delete cascade,
  folder_name  text not null,
  platform     text,
  folder_url   text,
  folder_id    text,
  status       public.checklist_status not null default 'not_started',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists model_drive_folders_model_id_idx on public.model_drive_folders(model_id);
drop trigger if exists trg_model_drive_folders_updated_at on public.model_drive_folders;
create trigger trg_model_drive_folders_updated_at before update on public.model_drive_folders
  for each row execute function public.set_updated_at();

-- ----- model_documents (matches api/models/documents/route.ts) ----------------
create table if not exists public.model_documents (
  id            uuid primary key default gen_random_uuid(),
  model_id      uuid not null references public.models(id) on delete cascade,
  description   text not null,
  file_name     text not null,
  storage_path  text not null,
  mime_type     text,
  file_size     bigint,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists model_documents_model_id_idx on public.model_documents(model_id);
drop trigger if exists trg_model_documents_updated_at on public.model_documents;
create trigger trg_model_documents_updated_at before update on public.model_documents
  for each row execute function public.set_updated_at();

-- ----- model_payments --------------------------------------------------------
create table if not exists public.model_payments (
  id                    uuid primary key default gen_random_uuid(),
  model_id              uuid not null references public.models(id) on delete cascade,
  pix_key               text,
  pix_type              text,
  bank_name             text,
  bank_account          text,
  bank_agency           text,
  account_holder_name   text,
  account_holder_cpf    text,
  payment_frequency     text,
  model_percentage      numeric(5,2) default 60,
  agency_percentage     numeric(5,2) default 20,
  marketing_percentage  numeric(5,2) default 20,
  status                public.checklist_status not null default 'not_started',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists model_payments_model_id_idx on public.model_payments(model_id);
drop trigger if exists trg_model_payments_updated_at on public.model_payments;
create trigger trg_model_payments_updated_at before update on public.model_payments
  for each row execute function public.set_updated_at();

-- ----- model_earnings_reports (matches api/models/earnings/route.ts) ----------
create table if not exists public.model_earnings_reports (
  id                uuid primary key default gen_random_uuid(),
  model_id          uuid not null references public.models(id) on delete cascade,
  platform          text,
  period            text,
  gross_revenue     numeric(12,2) not null default 0 check (gross_revenue >= 0),
  model_share       numeric(12,2) not null default 0,
  agency_share      numeric(12,2) not null default 0,
  marketing_share   numeric(12,2) not null default 0,
  report_date       date,
  visible_to_model  boolean not null default false,
  admin_note        text,
  image_path        text,
  uploaded_by       uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists model_earnings_model_id_idx on public.model_earnings_reports(model_id);
create index if not exists model_earnings_visible_idx
  on public.model_earnings_reports(model_id, visible_to_model);
drop trigger if exists trg_model_earnings_updated_at on public.model_earnings_reports;
create trigger trg_model_earnings_updated_at before update on public.model_earnings_reports
  for each row execute function public.set_updated_at();

-- ----- model_onboarding_items (matches api/models/onboarding/route.ts) --------
create table if not exists public.model_onboarding_items (
  id                uuid primary key default gen_random_uuid(),
  model_id          uuid not null references public.models(id) on delete cascade,
  item_key          text not null,
  platform          text not null default 'onlyfans',
  section_key       text not null,
  section_title     text not null,
  section_order     integer not null default 0,
  item_title        text not null,
  item_description  text,
  item_order        integer not null default 0,
  responsibility    public.responsibility not null default 'agency',
  completed         boolean not null default false,
  completed_at      timestamptz,
  completed_by      uuid references public.profiles(id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (model_id, platform, item_key)
);
create index if not exists onboarding_model_platform_idx
  on public.model_onboarding_items(model_id, platform);

create or replace function public.sync_onboarding_completed_at()
returns trigger language plpgsql as $$
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
create trigger trg_onboarding_completed_at before update on public.model_onboarding_items
  for each row execute function public.sync_onboarding_completed_at();
drop trigger if exists trg_onboarding_updated_at on public.model_onboarding_items;
create trigger trg_onboarding_updated_at before update on public.model_onboarding_items
  for each row execute function public.set_updated_at();

-- ----- model_notes -----------------------------------------------------------
create table if not exists public.model_notes (
  id               uuid primary key default gen_random_uuid(),
  model_id         uuid not null references public.models(id) on delete cascade,
  author_id        uuid not null references public.profiles(id) on delete set null,
  author_name      text,
  author_role      public.management_role,
  body             text not null check (length(btrim(body)) > 0),
  priority         text default 'normal' check (priority in ('normal', 'important', 'urgent')),
  pinned           boolean not null default false,
  archived         boolean not null default false,
  created_by       uuid references public.profiles(id) on delete set null,
  created_by_name  text,
  created_by_role  public.management_role,
  updated_by       uuid references public.profiles(id) on delete set null,
  updated_by_name  text,
  updated_by_role  public.management_role,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists model_notes_model_id_idx on public.model_notes(model_id);
create index if not exists model_notes_created_at_idx on public.model_notes(model_id, created_at desc);
create index if not exists model_notes_pinned_idx on public.model_notes(model_id, pinned desc);
drop trigger if exists trg_model_notes_updated_at on public.model_notes;
create trigger trg_model_notes_updated_at before update on public.model_notes
  for each row execute function public.set_updated_at();

-- ----- model_note_history (audit trail for notes) ---------------------------
create table if not exists public.model_note_history (
  id              uuid primary key default gen_random_uuid(),
  note_id         uuid not null references public.model_notes(id) on delete cascade,
  model_id        uuid not null references public.models(id) on delete cascade,
  action          text not null,
  original_body   text,
  updated_body    text,
  editor_id       uuid references public.profiles(id) on delete set null,
  editor_name     text,
  editor_role     public.management_role,
  created_at      timestamptz not null default now()
);
create index if not exists model_note_history_note_id_idx on public.model_note_history(note_id);
create index if not exists model_note_history_model_id_idx on public.model_note_history(model_id);

-- ----- Auto-provision a profile when an auth user is created ------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::public.management_role, 'model'),
    true
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

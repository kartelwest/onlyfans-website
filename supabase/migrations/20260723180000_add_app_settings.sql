-- =============================================================================
-- Karay Models — app_settings: small key/value store for admin-configurable
-- toggles. First use: whether the PDF/image model importer (Part D) auto-saves
-- extracted records or requires owner confirmation first (default: confirm-first).
-- =============================================================================

create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_app_settings_updated_at on public.app_settings;
create trigger trg_app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value)
values ('model_importer_auto_save', 'false'::jsonb)
on conflict (key) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists app_settings_select on public.app_settings;
create policy app_settings_select on public.app_settings for select to authenticated
  using ( public.is_staff() );

drop policy if exists app_settings_insert on public.app_settings;
create policy app_settings_insert on public.app_settings for insert to authenticated
  with check ( public.is_owner() );

drop policy if exists app_settings_update on public.app_settings;
create policy app_settings_update on public.app_settings for update to authenticated
  using ( public.is_owner() ) with check ( public.is_owner() );

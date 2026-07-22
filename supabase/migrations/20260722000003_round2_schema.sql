-- =============================================================================
-- KARRAY Models — Round 2 schema deltas (run AFTER initial schema + RLS)
-- =============================================================================

-- New model columns for the two content-folder links
alter table public.models
  add column if not exists drive_videos_url text,
  add column if not exists drive_photos_url text;

-- Audit log
create table if not exists public.model_audit_log (
  id          uuid primary key default gen_random_uuid(),
  model_id    uuid not null references public.models(id) on delete cascade,
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_name  text,
  actor_role  public.management_role,
  field       text not null,
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);
create index if not exists model_audit_log_model_id_idx
  on public.model_audit_log(model_id, created_at desc);

alter table public.model_audit_log enable row level security;

-- Read: staff or assigned rep. Insert happens via service role / server actions.
drop policy if exists audit_select on public.model_audit_log;
create policy audit_select on public.model_audit_log for select to authenticated
  using ( public.is_staff() or public.is_assigned_rep(model_id) );

-- Public avatar bucket (public read is fine for non-sensitive profile photos;
-- write limited to staff + the assigned representative).
insert into storage.buckets (id, name, public)
values ('model-avatars', 'model-avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select
  using ( bucket_id = 'model-avatars' );

drop policy if exists avatars_write on storage.objects;
create policy avatars_write on storage.objects for all to authenticated
  using (
    bucket_id = 'model-avatars'
    and ( public.is_staff()
          or public.is_assigned_rep( (storage.foldername(name))[1]::uuid ) )
  )
  with check (
    bucket_id = 'model-avatars'
    and ( public.is_staff()
          or public.is_assigned_rep( (storage.foldername(name))[1]::uuid ) )
  );

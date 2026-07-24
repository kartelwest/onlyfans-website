-- =============================================================================
-- KARAY Models — Rep-view Model Dashboard support
--
-- NOTE: the live schema has drifted from earlier migration files in this repo
-- (helper predicates now live as public.is_management() / public.is_owner() /
-- public.is_assigned_representative(uuid) / private.is_own_model(uuid), and
-- model_checklist statuses are stored as plain `text`, not the `checklist_status`
-- enum). This migration is written against the actual live schema, confirmed
-- via introspection, rather than against the older migration files.
--
-- Adds "Seus Dados" fields, stat counters, the missing `content_drive_url`
-- column (referenced by app/area-da-modelo but never migrated), and a
-- Section-6 (marketing socials) field set enforced as owner/administrator-only
-- at the database level — column grants + SECURITY DEFINER RPCs — not just
-- hidden in the UI.
-- =============================================================================

-- ----- models: content folder link (fixes a pre-existing missing column) -----
alter table public.models
  add column if not exists content_drive_url text;

-- ----- models: new "Seus Dados" fields + stat counters ------------------------
alter table public.models
  add column if not exists preferred_currency     text,
  add column if not exists content_frequency      text,
  add column if not exists block_brazil           boolean not null default false,
  add column if not exists show_face              boolean not null default true,
  add column if not exists referral_source        text,
  add column if not exists subscribers_count      integer not null default 0 check (subscribers_count >= 0),
  add column if not exists ppv_sold_count         integer not null default 0 check (ppv_sold_count >= 0),
  add column if not exists tips_amount            numeric(12,2) not null default 0 check (tips_amount >= 0);

-- ----- models: Section 6 — Social Accounts (Marketing) ------------------------
-- These two columns must never be readable by representative or model roles,
-- even via direct PostgREST/table access with a valid session — not just
-- omitted from the app's own queries. Every logged-in user maps to the same
-- shared `authenticated` Postgres role regardless of their app-level
-- management_role, so row-level policies alone can't tell an owner's read
-- from a rep's read of the same row. We revoke column-level SELECT/UPDATE
-- from `authenticated` entirely and expose the columns only through
-- SECURITY DEFINER RPCs that self-check public.is_management().
alter table public.models
  add column if not exists instagram_marketing    text,
  add column if not exists twitter_marketing       text;

revoke select (instagram_marketing, twitter_marketing) on public.models from authenticated;
revoke update (instagram_marketing, twitter_marketing) on public.models from authenticated;

create or replace function public.get_model_marketing(target_model uuid)
returns table (instagram_marketing text, twitter_marketing text)
language sql stable security definer set search_path = public as $$
  select m.instagram_marketing, m.twitter_marketing
  from public.models m
  where m.id = target_model and public.is_management()
$$;

create or replace function public.set_model_marketing(
  target_model uuid,
  new_instagram_marketing text,
  new_twitter_marketing text
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_management() then
    raise exception 'Only owner/administrator may edit marketing accounts.';
  end if;

  update public.models
     set instagram_marketing = new_instagram_marketing,
         twitter_marketing = new_twitter_marketing
   where id = target_model;
end $$;

grant execute on function public.get_model_marketing(uuid) to authenticated;
grant execute on function public.set_model_marketing(uuid, text, text) to authenticated;

-- ----- model_checklist: fixed 6-step rep-facing onboarding needs one more ----
-- step ("Proxy e navegador dedicados") with no existing column. Statuses on
-- this table are plain text in the live schema (see note above), so we match
-- that convention rather than introducing the unused `checklist_status` enum.
alter table public.model_checklist
  add column if not exists proxy_browser_status text not null default 'not_started';

-- ----- Storage: model avatars --------------------------------------------------
-- Public bucket (profile photos are not sensitive) so profile_photo_url can be
-- used directly as an <img src> without signed-url plumbing, consistent with
-- how profile_photo_url is already consumed across the app.
insert into storage.buckets (id, name, public)
values ('model-avatars', 'model-avatars', true) on conflict (id) do nothing;

-- Objects are stored as `${model_id}/${filename}`. A model may only write
-- under her own model_id folder; management may write under any.
drop policy if exists storage_model_avatars_write on storage.objects;
create policy storage_model_avatars_write on storage.objects for all to authenticated
  using (
    bucket_id = 'model-avatars'
    and (
      public.is_management()
      or private.is_own_model(( (storage.foldername(name))[1] )::uuid)
    )
  )
  with check (
    bucket_id = 'model-avatars'
    and (
      public.is_management()
      or private.is_own_model(( (storage.foldername(name))[1] )::uuid)
    )
  );

drop policy if exists storage_model_avatars_public_read on storage.objects;
create policy storage_model_avatars_public_read on storage.objects for select to public
  using (bucket_id = 'model-avatars');

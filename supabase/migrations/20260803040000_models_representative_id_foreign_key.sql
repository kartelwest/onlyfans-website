-- =============================================================================
-- KARAY Models — models.representative_id finally gets its foreign key
--
-- The initial schema declares it. Production never had it: only
-- models_profile_id_fkey and models_created_by_fkey existed, which cost twice.
--
--   1. PostgREST resolves embeds through foreign keys. Without one,
--      `profiles!representative_id ( full_name )` cannot be resolved and the
--      WHOLE query fails with PGRST200 — that is how /admin/pageview broke in
--      production, four times, before the embed was replaced with a second
--      query.
--
--   2. Deleting a representative left every one of her models pointing at an
--      account that no longer existed. Nothing cleaned up after her, because
--      the ON DELETE SET NULL everyone assumed was there simply was not.
--
-- Checked before adding: zero rows with a representative_id that has no
-- matching profile, so the constraint validates without touching data.
--
-- The partial index goes with it — every screen that lists a rep's models
-- filters on exactly this column.
-- =============================================================================

alter table public.models
  drop constraint if exists models_representative_id_fkey;

alter table public.models
  add constraint models_representative_id_fkey
  foreign key (representative_id) references public.profiles(id) on delete set null;

create index if not exists models_representative_id_idx
  on public.models (representative_id)
  where representative_id is not null;

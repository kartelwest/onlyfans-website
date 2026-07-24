-- =============================================================================
-- /api/aplicar inserts new applicants into public.models with status =
-- 'candidate'. That value was missing from the model_status enum, so those
-- inserts failed with 22P02 (invalid input value for enum model_status).
-- =============================================================================
alter type model_status add value if not exists 'candidate' before 'not_started';

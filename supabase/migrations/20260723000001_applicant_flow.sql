-- =============================================================================
-- Applicant flow: /aplicar submits directly to our backend and creates a
-- "candidate" model record. Notes created by that public submission have no
-- authenticated staff author, so author_id must be nullable.
-- =============================================================================

alter table public.model_notes
  alter column author_id drop not null;

-- =============================================================================
-- KARAY Models — permanent deletion of a MODEL belongs to the owner alone
--
-- The same drift that 20260803020000 found on public.profiles, on the table
-- that matters most.
--
-- FOUND BY TESTING, not by reading. The initial schema declared
--
--   models_delete  for delete to authenticated  using ( public.is_owner() )
--
-- but that policy is not what production runs. It was replaced, and
-- public.models ended up carrying TWO delete policies, neither of them the
-- owner-only one:
--
--   "management can delete models"   using ( public.is_management() )
--   models_delete_management         using ( private.is_management() )
--
-- Both `is_management()` variants resolve to role in ('owner','administrator').
-- RLS policies are permissive — they OR together — so an ADMINISTRATOR could
-- delete any model, and not only through the application: a plain DELETE to
-- /rest/v1/models with her own token was enough.
--
-- Verified against production inside an aborted transaction, acting as the
-- administrator: DELETE returned rows=1 before this migration.
--
-- WHY THIS IS THE ONE TO NARROW. public.models is the parent of more than
-- twenty tables that cascade on delete — earnings, model_earnings_reports,
-- model_ledger_entries, model_payments, documents, media_records,
-- video_assets, notes, model_notes, model_note_history, and
-- model_audit_history. Removing one row destroys the model, her whole
-- financial record and the entire audit trail that would show what happened.
-- It is the only action in the product that is both irreversible and
-- self-erasing, which is exactly why it sits with the owner.
--
-- An administrator keeps everything else: creating models, editing them,
-- changing status, credentials, earnings, notes. Only the irreversible step
-- narrows. Deactivating (models.active = false) remains the reversible path
-- available to every administrator, and it keeps all history attached.
--
-- The INSERT/UPDATE/SELECT policies are deliberately left as they are. They
-- are duplicated across a legacy public.is_management() set and a newer
-- private.is_management() set, which is untidy but equivalent; consolidating
-- them is not this migration's job.
-- =============================================================================

drop policy if exists "management can delete models" on public.models;
drop policy if exists models_delete_management        on public.models;
drop policy if exists models_delete                   on public.models;

create policy models_delete on public.models
  for delete to authenticated
  using ( public.is_owner() );

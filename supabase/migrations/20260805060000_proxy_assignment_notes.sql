-- =============================================================================
-- KARAY Models — a note every time a model is assigned a proxy.
--
-- Entering proxy details is not an edit to a settings field, it is an event:
-- that model is now working through a different address. The audit trail
-- already recorded it, but the audit trail is where you look when you already
-- suspect something. The Notes tab is where the team actually reads, so the
-- assignment goes there too.
--
-- `source` gains 'proxy', which is what tells those notes apart from something
-- a person typed — the same distinction 'ledger' and 'daily' already carry.
-- =============================================================================

alter table public.model_notes
  drop constraint if exists model_notes_source_check;
alter table public.model_notes
  add constraint model_notes_source_check
  check (source in ('manual', 'ledger', 'daily', 'proxy'));

comment on column public.model_notes.source is
  'manual = written by a person; ledger = generated with a financial entry; daily = written by the nightly daily-checklist job; proxy = written when a model is assigned a proxy.';

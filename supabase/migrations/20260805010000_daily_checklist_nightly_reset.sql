-- =============================================================================
-- KARAY Models — the nightly reset of the daily marketing checklist.
--
-- At 00:00 America/Sao_Paulo every tick from the day before is cleared so the
-- team starts the new day from zero, and any model whose checklist was not
-- touched at all gets an automatic note saying so.
--
-- What this adds:
--   1. models.daily_reset_on — the last Brazilian date the reset ran for that
--      model. It makes the job idempotent per model, so a retry after a
--      partial failure finishes the job instead of wiping a day twice.
--   2. model_notes may now hold a note nobody wrote: author_id becomes
--      nullable and `source` accepts 'daily'. Every other note still carries
--      its author; this is the one kind the system writes on its own.
-- =============================================================================

-- ----- 1. Per-model idempotency key ------------------------------------------
alter table public.models
  add column if not exists daily_reset_on date;

comment on column public.models.daily_reset_on is
  'The last Brazilian calendar date the daily checklist was reset for this model. Written only by the nightly job — see lib/daily/reset.ts.';

-- 20260724000002 revoked table-wide SELECT on public.models and re-granted it
-- column by column, so a NEW column is invisible to `authenticated` until it
-- is granted explicitly.
grant select (daily_reset_on) on public.models to authenticated;

-- ----- 2. A note the system writes -------------------------------------------
-- author_id was `not null references profiles(id)`, which assumes every note
-- has a person behind it. The "NÃO FOI TRABALHADO" note has none: it is the
-- absence of work, recorded. Nullable here, and null is what the job writes —
-- created_by_name carries the word "Sistema" so the Notes tab still reads.
alter table public.model_notes
  alter column author_id drop not null;

alter table public.model_notes
  drop constraint if exists model_notes_source_check;
alter table public.model_notes
  add constraint model_notes_source_check
  check (source in ('manual', 'ledger', 'daily'));

comment on column public.model_notes.source is
  'manual = written by a person; ledger = generated with a financial entry; daily = written by the nightly daily-checklist job.';

create index if not exists model_notes_daily_source_idx
  on public.model_notes (model_id, created_at desc)
  where source = 'daily';

-- ----- 3. A representative may read her own daily history ---------------------
-- rep_visible_audit_action() is the authority for which audit actions a
-- representative may read (20260804020000); app/api/models/history/route.ts
-- mirrors it. The daily checklist is her work, so her own ticks and notes —
-- and the nightly close of the day — have to be readable by her. Change one
-- and change the other.
create or replace function public.rep_visible_audit_action(p_action text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_action in (
    'onboarding_update',
    'checklist_update',
    'daily_update',
    'daily_reset'
  );
$$;

revoke execute on function public.rep_visible_audit_action(text) from public;
revoke execute on function public.rep_visible_audit_action(text) from anon;
grant execute on function public.rep_visible_audit_action(text) to authenticated;

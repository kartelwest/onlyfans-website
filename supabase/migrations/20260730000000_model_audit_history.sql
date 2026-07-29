-- =============================================================================
-- KARAY Models — Model audit history (comprehensive change tracking)
--
-- Creates a new `model_audit_history` table that records EVERY change made to
-- a model's profile or account, not just note changes.  The existing
-- `model_note_history` table is preserved for backward compatibility.
--
-- Access control:
--   SELECT: staff (owner/administrator) + assigned representative
--   INSERT: staff only (via API routes that use the service-role or RLS-allowed client)
--   UPDATE/DELETE: NEVER — append-only audit trail
-- =============================================================================

-- ----- model_audit_history ---------------------------------------------------
create table if not exists public.model_audit_history (
  id              uuid primary key default gen_random_uuid(),
  model_id        uuid not null references public.models(id) on delete cascade,
  action          text not null,
  field_name      text,
  previous_value  text,
  new_value       text,
  actor_id        uuid references public.profiles(id) on delete set null,
  actor_name      text,
  actor_role      public.management_role,
  source          text,
  summary         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists model_audit_history_model_id_idx
  on public.model_audit_history(model_id);
create index if not exists model_audit_history_created_at_idx
  on public.model_audit_history(model_id, created_at desc);
create index if not exists model_audit_history_action_idx
  on public.model_audit_history(model_id, action);
create index if not exists model_audit_history_field_idx
  on public.model_audit_history(model_id, field_name);
create index if not exists model_audit_history_actor_idx
  on public.model_audit_history(model_id, actor_id);

-- ----- Enable RLS ------------------------------------------------------------
alter table public.model_audit_history enable row level security;

-- SELECT: staff + assigned rep (models are explicitly excluded)
drop policy if exists audit_history_select on public.model_audit_history;
create policy audit_history_select on public.model_audit_history
  for select to authenticated
  using ( public.is_staff() or public.is_assigned_rep(model_id) );

-- INSERT: staff only — audit entries are created by API routes, never by users
drop policy if exists audit_history_insert on public.model_audit_history;
create policy audit_history_insert on public.model_audit_history
  for insert to authenticated
  with check ( public.is_staff() );

-- No UPDATE or DELETE policies — the table is append-only.
-- RLS defaults to denying when no policy matches, so rows can never be
-- modified or removed by any authenticated role.

-- Grant access to the authenticated role
grant select on public.model_audit_history to authenticated;
grant insert on public.model_audit_history to authenticated;

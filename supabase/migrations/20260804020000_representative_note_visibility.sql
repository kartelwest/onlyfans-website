-- =============================================================================
-- KARAY Models — What a representative sees on her client's page
--
-- NOTE ON DRIFT (same caveat as 20260803000001 / 20260804000000): written
-- against the LIVE schema. The audit policy from 20260730000000 uses
-- public.is_assigned_rep(uuid); the note policies use
-- public.is_assigned_representative(uuid). Both exist, and each policy below
-- keeps the predicate it already had, so neither name has to be reconciled.
--
-- WHERE THIS STARTS FROM
--
--   audit_history_select (20260730000000):
--       using ( public.is_staff() or public.is_assigned_rep(model_id) )
--
--   That is every row. A representative could already read the whole audit
--   trail for a model assigned to her — including model_credentials_updated,
--   whose previous_value/new_value carry the model's LOGIN E-MAIL before and
--   after. (The password never reaches the table: field_name "password" is in
--   the auditLogger SENSITIVE_FIELDS set, which nulls both value columns.)
--   Nothing in the UI showed it, because the representative's model page never
--   mounted a History tab — but /api/models/history admits representatives for
--   their own model, so those rows were one request away.
--
--   notes_select (20260803000001, extended 20260804000000):
--       staff, or a rep reading her OWN note on a model assigned to her.
--
-- WHAT CHANGES
--
--   1. model_notes gains rep_visible. An administrator ticks "readable by the
--      representative" on a note and the assigned rep can read it from then
--      on. Default false: a note is internal unless someone decides otherwise,
--      which is the safe direction to fail.
--   2. Only staff may set that flag. The guard trigger below is what enforces
--      it — RLS alone cannot, because a rep legitimately updates her own note's
--      text and a WITH CHECK clause cannot see the row's previous value.
--   3. A representative's audit read narrows to the onboarding checklist.
--      public.rep_visible_audit_action() is the single source of truth, and
--      app/api/models/history/route.ts mirrors it rather than keeping a second
--      copy of the list.
--
-- Deletion is untouched (notes_delete_owner, 20260801020000). The audit table
-- stays append-only: it has no UPDATE or DELETE policy and none is added here.
-- =============================================================================

-- ----- 1. The flag -----------------------------------------------------------
alter table public.model_notes
  add column if not exists rep_visible boolean not null default false;

comment on column public.model_notes.rep_visible is
  'Staff-controlled. When true, the model''s assigned representative may read '
  'this note even though she did not write it. Only is_staff() may change it '
  '(guard_note_rep_visible).';

create index if not exists model_notes_rep_visible_idx
  on public.model_notes (model_id)
  where rep_visible;

-- ----- 2. Only staff may share a note ----------------------------------------
--
-- A representative may update her own note (20260804000000), and
-- guard_note_representative_update already narrows her to the note's text.
-- This is the same idea for one specific column, and it is written separately
-- so that neither trigger has to know about the other's concern.
create or replace function public.guard_note_rep_visible()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.rep_visible is distinct from old.rep_visible
     and not public.is_staff()
  then
    raise exception 'Somente a equipe pode compartilhar uma nota com o representante.'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists trg_note_rep_visible on public.model_notes;
create trigger trg_note_rep_visible
  before update on public.model_notes
  for each row execute function public.guard_note_rep_visible();

revoke execute on function public.guard_note_rep_visible() from public;
revoke execute on function public.guard_note_rep_visible() from anon;
revoke execute on function public.guard_note_rep_visible() from authenticated;

-- ----- 3. A rep reads her own notes, plus the ones shared with her -----------
drop policy if exists notes_select on public.model_notes;
create policy notes_select on public.model_notes
  for select to authenticated
  using (
    public.is_staff()
    or (
      public.is_assigned_representative(model_id)
      and deleted_at is null
      and (
        created_by = auth.uid()
        or rep_visible
      )
    )
  );

-- ----- 4. The representative's slice of the audit trail ----------------------
--
-- Deliberately an ALLOW list, and a short one: the onboarding checklist is the
-- work a representative does, so it is the history she is shown. A new action
-- is invisible to representatives until someone adds it here — the safe
-- direction to fail, since a new action that logs something sensitive should
-- never widen its audience by default.
--
-- Everything else stays staff-only: credential changes, proxy details, the
-- financial trail, deletions, and the view-as records (which are a log of the
-- representative herself).
create or replace function public.rep_visible_audit_action(p_action text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_action in ('onboarding_update', 'checklist_update');
$$;

revoke execute on function public.rep_visible_audit_action(text) from public;
revoke execute on function public.rep_visible_audit_action(text) from anon;
grant execute on function public.rep_visible_audit_action(text) to authenticated;

drop policy if exists audit_history_select on public.model_audit_history;
create policy audit_history_select on public.model_audit_history
  for select to authenticated
  using (
    public.is_staff()
    or (
      public.is_assigned_rep(model_id)
      and public.rep_visible_audit_action(action)
    )
  );

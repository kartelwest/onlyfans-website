-- =============================================================================
-- KARAY Models — A representative may edit the notes she wrote
--
-- NOTE ON DRIFT (same caveat as 20260724000001 / 20260803000000): written
-- against the LIVE schema, where the role predicates are public.is_staff(),
-- public.is_owner() and public.is_assigned_representative(uuid). The argument
-- is passed positionally throughout, because production declares that function
-- as is_assigned_representative(target_model_id uuid) while a fresh database
-- gets is_assigned_representative(target_model uuid) — naming the argument
-- would break on one of the two.
--
-- Where this starts from (20260803000001_representative_system.sql):
--   notes_select  — staff, or a rep reading her OWN note on a model assigned
--                   to her, and only while it is not soft-deleted.
--   notes_insert  — staff, or a rep writing her own note on her own model.
--   notes_update  — staff only. So a representative could write a note and
--                   then never correct a typo in it.
--
-- What changes:
--   1. notes_update also admits a representative editing her own, non-deleted
--      note on a model still assigned to her.
--   2. A trigger narrows that to the note's TEXT. Everything else on the row —
--      authorship, which model it belongs to, pinned, archived, the soft-delete
--      columns, the ledger link — is unchanged by a non-staff writer. Without
--      this, "update your own note" would also mean "unpin, unarchive, and
--      quietly un-delete it", and reassigning created_by would let a rep hand
--      her note to someone else.
--   3. model_note_history accepts inserts from an assigned representative, so
--      a rep's edit is recorded with the body it replaced. An unrecordable
--      edit is worse than no edit: the API rolls the note back when the
--      history write fails, which under staff-only RLS meant a rep's edit
--      could never be saved at all.
--
-- Deletion is untouched: there is still no DELETE policy on model_notes for
-- `authenticated`, so nobody but the owner (through the SECURITY DEFINER
-- delete_model_note) can remove a note, and soft-delete stays owner-only in
-- the API. Reading the history stays staff-only.
-- =============================================================================

-- ----- 1. A rep may update her own note --------------------------------------
drop policy if exists notes_update on public.model_notes;
create policy notes_update on public.model_notes
  for update to authenticated
  using (
    public.is_staff()
    or (
      created_by = auth.uid()
      and public.is_assigned_representative(model_id)
      and deleted_at is null
    )
  )
  with check (
    public.is_staff()
    or (
      created_by = auth.uid()
      and public.is_assigned_representative(model_id)
      and deleted_at is null
    )
  );

-- ----- 2. …and only the text of it -------------------------------------------
create or replace function public.guard_note_representative_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Two writers keep the full row, and everything below is about neither of
  -- them:
  --
  --   auth.uid() is null — a service-role write with no acting user. The
  --     applicant intake and the credential-change note run this way; they
  --     bypass RLS entirely and must not be caught by a rule about
  --     representatives.
  --   is_staff()         — an owner or administrator, who may pin, archive and
  --     soft-delete by design.
  --
  -- What is left is a representative, and notes_update has already established
  -- that it is her own note on a model still assigned to her.
  if auth.uid() is null or public.is_staff() then
    return new;
  end if;

  if new.created_by is distinct from old.created_by
     or new.created_by_name is distinct from old.created_by_name
     or new.created_by_role is distinct from old.created_by_role
     or new.created_at is distinct from old.created_at
  then
    raise exception 'A autoria de uma nota não pode ser alterada.'
      using errcode = '42501';
  end if;

  if new.model_id is distinct from old.model_id then
    raise exception 'Uma nota não pode ser movida para outra modelo.'
      using errcode = '42501';
  end if;

  if new.deleted_at   is distinct from old.deleted_at
     or new.deleted_by is distinct from old.deleted_by
     or new.deleted_by_name is distinct from old.deleted_by_name
  then
    raise exception 'Apenas o proprietário pode excluir uma nota.'
      using errcode = '42501';
  end if;

  if new.pinned is distinct from old.pinned
     or new.archived is distinct from old.archived
  then
    raise exception 'Apenas a equipe pode fixar ou arquivar uma nota.'
      using errcode = '42501';
  end if;

  -- A ledger note is the model-facing face of an expense or loan. Its link to
  -- that entry is not a representative's to rewrite.
  if new.source is distinct from old.source
     or new.ledger_entry_id is distinct from old.ledger_entry_id
  then
    raise exception 'A origem de uma nota não pode ser alterada.'
      using errcode = '42501';
  end if;

  return new;
end $$;

drop trigger if exists trg_note_representative_update on public.model_notes;
create trigger trg_note_representative_update
  before update on public.model_notes
  for each row execute function public.guard_note_representative_update();

-- Called by the table, never directly.
revoke execute on function public.guard_note_representative_update() from public;
revoke execute on function public.guard_note_representative_update() from anon;
revoke execute on function public.guard_note_representative_update() from authenticated;

-- ----- 3. A rep's edit has to be recordable ----------------------------------
-- Reading the history is deliberately NOT extended: the history of a model's
-- notes is an internal record, and a rep sees only her own notes to begin with.
drop policy if exists note_history_insert_staff_only on public.model_note_history;
drop policy if exists note_history_insert on public.model_note_history;
create policy note_history_insert on public.model_note_history
  for insert to authenticated
  with check (
    public.is_staff()
    or public.is_assigned_representative(model_id)
  );

grant select, insert on public.model_note_history to authenticated;

-- anon holds table grants here only from Supabase's default privileges. RLS
-- denies it every row anyway, but an unauthenticated role has no business
-- holding write privileges on note history.
revoke all on public.model_note_history from anon;

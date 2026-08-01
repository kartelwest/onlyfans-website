-- =============================================================================
-- KARAY Models — the owner may delete any note
--
-- model_notes had no DELETE policy at all (20260731000000 left deletes denied
-- for `authenticated`), so nobody could remove a note. The owner — and only
-- the owner, administrators stay excluded exactly as 20260722000002 intended —
-- can now delete any note on any model.
--
-- Deleting a FINANCIAL note (source = 'ledger') also soft-deletes the ledger
-- entry it describes, in the same transaction. Without that, deleting the note
-- would leave the expense sitting in the model's Despesas / Empréstimos list
-- and still being subtracted from her month: the note is the model-facing face
-- of the entry, so the two have to go together.
--
-- The record of the deletion lives in model_audit_history, NOT in
-- model_note_history: the latter's note_id FK is ON DELETE CASCADE, so its rows
-- die with the note they describe. The full body is copied into the audit row
-- before the delete so nothing is actually lost.
-- =============================================================================

-- ----- RLS: owner-only DELETE ------------------------------------------------
drop policy if exists notes_delete_owner on public.model_notes;
create policy notes_delete_owner on public.model_notes
  for delete to authenticated
  using ( public.is_owner() );

grant delete on public.model_notes to authenticated;

-- ----- One transaction: entry + note + audit ---------------------------------
create or replace function public.delete_model_note(p_note_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_actor_id   uuid;
  v_actor_name text;
  v_actor_role public.app_role;
  v_note       public.model_notes;
  v_entry_id   uuid;
begin
  if not public.is_owner() then
    raise exception 'Somente o proprietário pode excluir notas.'
      using errcode = '42501';
  end if;

  select * into v_note from public.model_notes where id = p_note_id;

  if v_note.id is null then
    raise exception 'Nota não encontrada.' using errcode = 'P0002';
  end if;

  select id, coalesce(full_name, 'Usuário'), role
    into v_actor_id, v_actor_name, v_actor_role
    from public.profiles where id = auth.uid();

  -- A financial note takes its entry with it, so the model's expense list and
  -- the month's deductions stop showing something that no longer exists.
  if v_note.source = 'ledger' and v_note.ledger_entry_id is not null then
    update public.model_ledger_entries
       set deleted_at = coalesce(deleted_at, now()),
           updated_by = v_actor_id
     where id = v_note.ledger_entry_id
    returning id into v_entry_id;
  end if;

  delete from public.model_notes where id = p_note_id;

  -- models.latest_note_summary may have been quoting the note just removed.
  update public.models
     set latest_note_summary = (
       select left(btrim(n.body), 250)
         from public.model_notes n
        where n.model_id = v_note.model_id
          and n.archived = false
        order by n.pinned desc, n.updated_at desc
        limit 1
     )
   where id = v_note.model_id;

  insert into public.model_audit_history (
    model_id, action, field_name, previous_value, new_value,
    actor_id, actor_name, actor_role, source, summary
  ) values (
    v_note.model_id,
    'note_deleted',
    case when v_entry_id is null then 'note' else 'ledger_entry' end,
    v_note.body,
    null,
    v_actor_id, v_actor_name, v_actor_role, 'rpc:delete_model_note',
    case
      when v_entry_id is null then 'Nota excluída — ' || v_note.body
      else 'Nota de lançamento excluída (o lançamento também saiu da área da modelo) — ' || v_note.body
    end
  );

  return jsonb_build_object(
    'model_id', v_note.model_id,
    'source', v_note.source,
    'ledger_entry_id', v_entry_id
  );
end $$;

revoke execute on function public.delete_model_note(uuid) from public, anon;
grant execute on function public.delete_model_note(uuid) to authenticated;

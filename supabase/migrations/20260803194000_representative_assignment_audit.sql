-- =============================================================================
-- KARAY Models — Representative assignment audit note
--
-- Every change to models.representative_id now creates a complete note on the
-- model.  The note is generated inside the database so the update and the audit
-- record are atomic in the same transaction; if the note cannot be created the
-- representative change rolls back.
--
-- The acting user is passed through models.representative_changed_by on update.
-- On creation with an assigned representative, models.created_by is used as the
-- actor.  Unauthenticated creation workflows (public application) have no
-- authenticated actor and are left to their own intake notes.
-- =============================================================================

-- ----- Metadata columns for the audit note ------------------------------------
alter table public.models
  add column if not exists representative_changed_by uuid references public.profiles(id) on delete set null,
  add column if not exists representative_changed_at timestamptz;

alter table public.model_notes
  add column if not exists previous_representative_id uuid references public.profiles(id) on delete set null,
  add column if not exists new_representative_id uuid references public.profiles(id) on delete set null;

-- ----- Trigger function: create the note atomically ---------------------------
create or replace function public.model_representative_assignment_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_model_id        uuid := new.id;
  v_prev_id         uuid := null;
  v_new_id          uuid := new.representative_id;
  v_actor_id        uuid;
  v_actor_name      text;
  v_actor_role      text;
  v_prev_name       text := null;
  v_new_name        text := null;
  v_role_label      text;
  v_timestamp       text;
  v_body            text;
  v_note_id         uuid;
begin
  if TG_OP = 'UPDATE' then
    if new.representative_id is not distinct from old.representative_id then
      return new;
    end if;

    v_prev_id := old.representative_id;
    v_actor_id := new.representative_changed_by;

    if v_actor_id is null then
      raise exception 'representative_changed_by is required when changing a model representative'
        using errcode = '23502';
    end if;
  elsif TG_OP = 'INSERT' then
    if new.representative_id is null then
      return new;
    end if;

    v_actor_id := coalesce(new.representative_changed_by, new.created_by);

    if v_actor_id is null then
      -- Public, unauthenticated creation workflows carry their own intake note.
      return new;
    end if;
  else
    return new;
  end if;

  -- Resolve the actor's display name and role from the trusted profiles table.
  select full_name, role::text
    into v_actor_name, v_actor_role
    from public.profiles
   where id = v_actor_id;

  if v_actor_name is null then
    v_actor_name := 'Usuário';
  end if;

  if v_actor_role is null then
    v_actor_role := 'administrator';
  end if;

  v_role_label := case v_actor_role
    when 'owner' then 'Proprietário'
    when 'administrator' then 'Administrador'
    when 'representative' then 'Representante'
    else initcap(v_actor_role::text)
  end;

  -- Keep the previous and new names for the body, even if one is later deleted.
  if v_prev_id is not null then
    select full_name into v_prev_name from public.profiles where id = v_prev_id;
  end if;

  if v_new_id is not null then
    select full_name into v_new_name from public.profiles where id = v_new_id;
  end if;

  v_timestamp := to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');

  if v_prev_id is null and v_new_id is not null then
    v_body := format('%s foi atribuído(a) como representante da modelo por %s, %s, em %s.',
      coalesce(v_new_name, 'Representante'),
      v_actor_name,
      v_role_label,
      v_timestamp);
  elsif v_prev_id is not null and v_new_id is null then
    v_body := format('%s foi removido(a) como representante da modelo por %s, %s, em %s.',
      coalesce(v_prev_name, 'Representante'),
      v_actor_name,
      v_role_label,
      v_timestamp);
  elsif v_prev_id is not null and v_new_id is not null then
    v_body := format('Responsável alterado de %s para %s por %s, %s, em %s.',
      coalesce(v_prev_name, 'Representante'),
      coalesce(v_new_name, 'Representante'),
      v_actor_name,
      v_role_label,
      v_timestamp);
  else
    return new;
  end if;

  insert into public.model_notes (
    model_id,
    body,
    priority,
    pinned,
    archived,
    source,
    previous_representative_id,
    new_representative_id,
    created_context,
    created_by,
    created_by_name,
    created_by_role,
    updated_by,
    updated_by_name,
    updated_by_role
  ) values (
    v_model_id,
    v_body,
    'normal',
    false,
    false,
    'manual',
    v_prev_id,
    v_new_id,
    'representative_assignment',
    v_actor_id,
    v_actor_name,
    v_actor_role,
    v_actor_id,
    v_actor_name,
    v_actor_role
  ) returning id into v_note_id;

  insert into public.model_note_history (
    note_id,
    model_id,
    action,
    original_body,
    updated_body,
    editor_id,
    editor_name,
    editor_role
  ) values (
    v_note_id,
    v_model_id,
    'created',
    null,
    v_body,
    v_actor_id,
    v_actor_name,
    v_actor_role
  );

  update public.models
     set latest_note_summary = left(v_body, 250)
   where id = v_model_id;

  return new;
end;
$$;

-- ----- Trigger: fire only when the representative column actually changes -------
drop trigger if exists trg_model_representative_assignment_audit on public.models;
create trigger trg_model_representative_assignment_audit
  after insert or update of representative_id on public.models
  for each row execute function public.model_representative_assignment_audit();

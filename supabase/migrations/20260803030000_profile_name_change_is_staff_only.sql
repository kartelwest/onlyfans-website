-- =============================================================================
-- KARAY Models — a profile's name may only be changed by staff
--
-- FOUND BY TESTING: a representative could rename her own profile. RLS allows
-- a user to update their own row (profiles_update_self_or_management), and
-- manage_profile_columns only guarded role, status and active — so full_name
-- was open.
--
-- That name is not decoration. It is copied onto every note
-- (model_notes.created_by_name), into model_audit_history.actor_name and into
-- system_audit_log.actor_name, and models.display_name mirrors it through
-- trg_sync_model_display_name. A trail that the subject can rewrite is not a
-- trail.
--
-- So the guard now covers it: non-staff cannot change full_name on any row,
-- their own included. Everything else a user may keep for themselves — phone,
-- for instance — stays self-service.
--
-- Staff paths are unaffected: /api/models/update writes profiles.full_name
-- through the request-scoped client of an owner or administrator, so
-- public.is_staff() is true there. Service-role writes never touch full_name.
--
-- Verified against production inside an aborted transaction:
--   representative renames herself  -> REFUSED 42501
--   representative updates her phone -> allowed
--   administrator renames her        -> allowed
-- =============================================================================

create or replace function public.manage_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role and not public.is_owner() then
      raise exception 'Apenas o proprietário pode alterar o papel.' using errcode = '42501';
    end if;

    if (new.active is distinct from old.active
        or new.status is distinct from old.status)
       and not public.is_staff()
    then
      raise exception 'Apenas a equipe pode alterar status ou ativação.' using errcode = '42501';
    end if;

    -- The name on every note and audit row. Self-service stops here.
    if new.full_name is distinct from old.full_name and not public.is_staff() then
      raise exception 'Apenas a equipe pode alterar o nome do perfil.' using errcode = '42501';
    end if;
  end if;

  -- Representative active flag follows status.
  if new.role = 'representative' then
    new.active := (new.status = 'ativa');
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;

  return new;
end $$;

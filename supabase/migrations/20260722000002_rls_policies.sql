-- =============================================================================
-- KARRAY Models — Row-Level Security + Storage policies (run AFTER schema)
-- owner: full access. administrator: full EXCEPT account mgmt & deleting notes.
-- representative: READ-ONLY on assigned models; may ADD notes only.
-- model: READ-ONLY on own record; earnings only when visible_to_model = true.
-- Service-role key still bypasses RLS — use it only for privileged ops.
-- =============================================================================

-- ----- Helper functions (SECURITY DEFINER avoids profiles-RLS recursion) ------
create or replace function public.is_active_user()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select active and role = 'owner'
    from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select active and role in ('owner','administrator')
    from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_assigned_rep(target_model uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_user() and exists (
    select 1 from public.models m
     where m.id = target_model and m.representative_id = auth.uid())
$$;

create or replace function public.owns_model(target_model uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_active_user() and exists (
    select 1 from public.models m
     where m.id = target_model and m.profile_id = auth.uid())
$$;

create or replace function public.can_read_model(target_model uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
      or public.is_assigned_rep(target_model)
      or public.owns_model(target_model)
$$;

grant execute on function
  public.is_active_user(), public.is_owner(), public.is_staff(),
  public.is_assigned_rep(uuid), public.owns_model(uuid), public.can_read_model(uuid)
to authenticated;

-- ----- Enable RLS ------------------------------------------------------------
alter table public.profiles                enable row level security;
alter table public.models                  enable row level security;
alter table public.model_checklist         enable row level security;
alter table public.model_platforms         enable row level security;
alter table public.model_drive_folders     enable row level security;
alter table public.model_documents         enable row level security;
alter table public.model_payments          enable row level security;
alter table public.model_earnings_reports  enable row level security;
alter table public.model_onboarding_items  enable row level security;
alter table public.model_notes             enable row level security;
alter table public.model_note_history     enable row level security;

-- ----- profiles --------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using ( id = auth.uid() or public.is_staff() );

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check ( public.is_owner() );

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using ( id = auth.uid() or public.is_owner() )
  with check ( id = auth.uid() or public.is_owner() );

drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using ( public.is_owner() );

-- Only owner may change role/active on a profile.
create or replace function public.guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role or new.active is distinct from old.active)
     and not public.is_owner() then
    raise exception 'Only the owner can change role or active status.';
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_profile_cols on public.profiles;
create trigger trg_guard_profile_cols before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- ----- models ----------------------------------------------------------------
drop policy if exists models_select on public.models;
create policy models_select on public.models for select to authenticated
  using ( public.is_staff() or representative_id = auth.uid() or profile_id = auth.uid() );

drop policy if exists models_insert on public.models;
create policy models_insert on public.models for insert to authenticated
  with check ( public.is_staff() );

drop policy if exists models_update on public.models;
create policy models_update on public.models for update to authenticated
  using ( public.is_staff() ) with check ( public.is_staff() );

drop policy if exists models_delete on public.models;
create policy models_delete on public.models for delete to authenticated
  using ( public.is_owner() );

-- ----- child tables: read = can_read_model; write = staff --------------------
drop policy if exists checklist_select on public.model_checklist;
create policy checklist_select on public.model_checklist for select to authenticated
  using ( public.can_read_model(model_id) );
drop policy if exists checklist_write on public.model_checklist;
create policy checklist_write on public.model_checklist for all to authenticated
  using ( public.is_staff() ) with check ( public.is_staff() );

drop policy if exists platforms_select on public.model_platforms;
create policy platforms_select on public.model_platforms for select to authenticated
  using ( public.can_read_model(model_id) );
drop policy if exists platforms_write on public.model_platforms;
create policy platforms_write on public.model_platforms for all to authenticated
  using ( public.is_staff() ) with check ( public.is_staff() );

drop policy if exists drive_select on public.model_drive_folders;
create policy drive_select on public.model_drive_folders for select to authenticated
  using ( public.can_read_model(model_id) );
drop policy if exists drive_write on public.model_drive_folders;
create policy drive_write on public.model_drive_folders for all to authenticated
  using ( public.is_staff() ) with check ( public.is_staff() );

-- documents & payments: sensitive — staff + assigned rep read; staff write
drop policy if exists documents_select on public.model_documents;
create policy documents_select on public.model_documents for select to authenticated
  using ( public.is_staff() or public.is_assigned_rep(model_id) );
drop policy if exists documents_write on public.model_documents;
create policy documents_write on public.model_documents for all to authenticated
  using ( public.is_staff() ) with check ( public.is_staff() );

drop policy if exists payments_select on public.model_payments;
create policy payments_select on public.model_payments for select to authenticated
  using ( public.is_staff() or public.is_assigned_rep(model_id) );
drop policy if exists payments_write on public.model_payments;
create policy payments_write on public.model_payments for all to authenticated
  using ( public.is_staff() ) with check ( public.is_staff() );

-- onboarding: model may read own; staff write
drop policy if exists onboarding_select on public.model_onboarding_items;
create policy onboarding_select on public.model_onboarding_items for select to authenticated
  using ( public.can_read_model(model_id) );
drop policy if exists onboarding_write on public.model_onboarding_items;
create policy onboarding_write on public.model_onboarding_items for all to authenticated
  using ( public.is_staff() ) with check ( public.is_staff() );

-- ----- earnings: model sees only visible_to_model rows -----------------------
drop policy if exists earnings_select on public.model_earnings_reports;
create policy earnings_select on public.model_earnings_reports for select to authenticated
  using (
    public.is_staff()
    or public.is_assigned_rep(model_id)
    or ( public.owns_model(model_id) and visible_to_model = true )
  );
drop policy if exists earnings_write on public.model_earnings_reports;
create policy earnings_write on public.model_earnings_reports for all to authenticated
  using ( public.is_staff() ) with check ( public.is_staff() );

-- ----- notes: add=staff/rep(assigned); edit=staff; delete=OWNER ONLY ---------
drop policy if exists notes_select on public.model_notes;
create policy notes_select on public.model_notes for select to authenticated
  using ( public.is_staff() or public.is_assigned_rep(model_id) );

drop policy if exists notes_insert on public.model_notes;
create policy notes_insert on public.model_notes for insert to authenticated
  with check ( author_id = auth.uid()
    and ( public.is_staff() or public.is_assigned_rep(model_id) ) );

drop policy if exists notes_update on public.model_notes;
create policy notes_update on public.model_notes for update to authenticated
  using ( public.is_staff() ) with check ( public.is_staff() );

drop policy if exists notes_delete on public.model_notes;
create policy notes_delete on public.model_notes for delete to authenticated
  using ( public.is_owner() );   -- administrators intentionally excluded

-- ----- note_history: read=staff/rep(assigned); insert=staff only (audit) -----
drop policy if exists note_history_select on public.model_note_history;
create policy note_history_select on public.model_note_history for select to authenticated
  using ( public.is_staff() or public.is_assigned_rep(model_id) );

drop policy if exists note_history_insert on public.model_note_history;
create policy note_history_insert on public.model_note_history for insert to authenticated
  with check ( public.is_staff() );

-- ----- Private storage buckets + object policies (staff-only direct access) ---
insert into storage.buckets (id, name, public)
values ('model-documents', 'model-documents', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
values ('model-earnings', 'model-earnings', false) on conflict (id) do nothing;

drop policy if exists storage_model_documents_all on storage.objects;
create policy storage_model_documents_all on storage.objects for all to authenticated
  using ( bucket_id = 'model-documents' and public.is_staff() )
  with check ( bucket_id = 'model-documents' and public.is_staff() );

drop policy if exists storage_model_earnings_all on storage.objects;
create policy storage_model_earnings_all on storage.objects for all to authenticated
  using ( bucket_id = 'model-earnings' and public.is_staff() )
  with check ( bucket_id = 'model-earnings' and public.is_staff() );

-- =============================================================================
-- KARAY Models — Notes are internal: owner + administrator only
--
-- NOTE ON DRIFT: the live database does NOT match
-- 20260722000002_rls_policies.sql. That file created notes_select /
-- notes_insert / notes_update / notes_delete on public.model_notes; none of
-- those policies exist in production. They were replaced at some point by
-- permissive policies named "Authenticated users can {read,insert,update}
-- notes" whose USING / WITH CHECK expressions are literally `true`. Same story
-- on public.model_note_history. This migration is written against the live
-- schema, confirmed via introspection, exactly as 20260724000001 had to be.
--
-- Impact of the `true` policies: every authenticated user — including a model
-- and including a representative looking at a model who is not hers — could
-- read, insert and edit EVERY note on EVERY model with a single direct
-- PostgREST call (`GET /rest/v1/model_notes?select=*`). The application UI
-- never did this, which is why it went unnoticed, but the API was wide open.
--
-- Notes are internal agency records. Only owner and administrator may read
-- them. public.is_staff() is exactly that predicate (active AND role in
-- ('owner','administrator')).
--
-- The service-role key bypasses RLS entirely, so the two server-side writers
-- that use the admin client — the public /aplicar applicant intake and the
-- credential-reset audit note — are unaffected by everything below.
-- =============================================================================

-- ----- model_notes -----------------------------------------------------------
drop policy if exists "Authenticated users can read notes"   on public.model_notes;
drop policy if exists "Authenticated users can insert notes" on public.model_notes;
drop policy if exists "Authenticated users can update notes" on public.model_notes;

-- Also drop the names from 20260722000002 in case any environment still has
-- them, so this migration converges no matter which variant it starts from.
drop policy if exists notes_select on public.model_notes;
drop policy if exists notes_insert on public.model_notes;
drop policy if exists notes_update on public.model_notes;

create policy notes_select_staff_only on public.model_notes
  for select to authenticated
  using ( public.is_staff() );

create policy notes_insert_staff_only on public.model_notes
  for insert to authenticated
  with check ( public.is_staff() );

create policy notes_update_staff_only on public.model_notes
  for update to authenticated
  using ( public.is_staff() ) with check ( public.is_staff() );

-- No DELETE policy: deletes stay denied for `authenticated` (unchanged — RLS
-- denies by default when no policy matches).

-- ----- model_note_history ----------------------------------------------------
-- original_body / updated_body hold full note text, so this table leaks
-- exactly as much as model_notes does and gets the same treatment.
drop policy if exists "Authenticated users can read note history"   on public.model_note_history;
drop policy if exists "Authenticated users can insert note history" on public.model_note_history;

drop policy if exists note_history_select on public.model_note_history;
drop policy if exists note_history_insert on public.model_note_history;

create policy note_history_select_staff_only on public.model_note_history
  for select to authenticated
  using ( public.is_staff() );

create policy note_history_insert_staff_only on public.model_note_history
  for insert to authenticated
  with check ( public.is_staff() );

-- ----- models.latest_note_summary --------------------------------------------
-- This column holds the first 250 characters of the model's most recent note
-- body (written by updateLatestNoteSummary in app/api/models/notes/route.ts).
-- It is note content living on the `models` row, so locking down model_notes
-- while leaving this readable would just move the leak: models_select_authorized
-- lets a model read her own row and a representative read her assigned rows.
--
-- Row-level policies cannot help here — every logged-in user maps to the same
-- `authenticated` Postgres role — so we use the column-allowlist mechanism
-- established by 20260724000002 and expose the column through a SECURITY
-- DEFINER RPC that self-checks public.is_staff(), the same shape already used
-- for instagram_marketing / twitter_marketing and the proxy_* columns.
--
-- Only SELECT is revoked. UPDATE stays granted so updateLatestNoteSummary
-- keeps working (it issues a bare UPDATE with no RETURNING clause).
do $$
declare
  col_list text;
  excluded_cols text[] := array[
    'instagram_marketing',
    'twitter_marketing',
    'proxy_ip',
    'proxy_company',
    'proxy_company_other',
    'proxy_country',
    'latest_note_summary'
  ];
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into col_list
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'models'
     and column_name <> all (excluded_cols);

  if col_list is null then
    raise exception 'models table introspection returned no columns — aborting to avoid locking out all reads';
  end if;

  execute 'revoke select on public.models from authenticated';
  execute format('grant select (%s) on public.models to authenticated', col_list);
end $$;

create or replace function public.get_models_latest_note_summary(target_models uuid[])
returns table (model_id uuid, latest_note_summary text)
language sql stable security definer set search_path = public as $$
  select m.id, m.latest_note_summary
  from public.models m
  where m.id = any(target_models)
    and public.is_staff()
$$;

revoke execute on function public.get_models_latest_note_summary(uuid[]) from public;
grant execute on function public.get_models_latest_note_summary(uuid[]) to authenticated;

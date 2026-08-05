-- =============================================================================
-- KARAY Models — nightly database export
--
-- The project is on the Supabase free plan: no automated backups, no
-- point-in-time recovery. Until that changes, the only copies of the business
-- records that exist are the ones this function produces.
--
-- WHY A FUNCTION AND NOT A LIST OF QUERIES IN THE ROUTE. A backup that names
-- its tables goes stale the first time somebody adds one, and does it
-- silently — the job keeps reporting success while quietly skipping the new
-- data. This walks pg_class instead, so every table in `public` is included
-- the day it is created, and the export cannot drift out of step with the
-- schema.
--
-- WHY IT RETURNS text AND NOT jsonb. Postgres `numeric` carries its scale:
-- 500.00 and 5.06750000 are stored, and serialized, with those trailing
-- zeros. Every JSON parser in JavaScript turns them into IEEE doubles, so a
-- route that parsed this payload would write 500 and 5.0675 into the backup
-- and quietly round money and FX rates on the way to disk. Handing back a
-- single text value means the caller moves bytes it never interprets.
--
-- SECURITY. SECURITY DEFINER, because it reads auth.users and every RLS-
-- protected table. EXECUTE is granted to service_role ONLY: Supabase hands
-- every new public function an EXECUTE grant to anon and authenticated, so
-- those are revoked explicitly rather than relying on `revoke from public`.
-- No signed-in user can call this — it would be a complete read of the
-- database in one request.
--
-- Password hashes are deliberately excluded. Restoring an account recreates
-- it without its password, which is the intended trade: a file of hashes is a
-- liability, and a password reset is a nuisance.
--
-- SCALE. This materializes the whole database as one value in memory. That is
-- right for a dataset of this size (hundreds of rows) and will stop being
-- right eventually. When it does, the answer is Supabase Pro's managed
-- backups plus pg_dump, not a bigger version of this.
-- =============================================================================

create or replace function public.export_database_backup()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  tbl      record;
  payload  jsonb;
  rows     jsonb;
  tables   jsonb := '{}'::jsonb;
begin
  for tbl in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
     order by c.relname
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x',
      tbl.relname
    ) into rows;

    tables := tables || jsonb_build_object(tbl.relname, rows);
  end loop;

  payload := jsonb_build_object(
    'kind', 'karay-database-backup',
    'format_version', 1,
    'generated_at', now(),
    'database', current_database(),
    'postgres_version', version(),
    'tables', tables,
    -- Recreated without passwords; see the header.
    'auth_users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'email_confirmed_at', u.email_confirmed_at,
        'banned_until', u.banned_until,
        'raw_app_meta_data', u.raw_app_meta_data,
        'raw_user_meta_data', u.raw_user_meta_data
      ) order by u.created_at), '[]'::jsonb)
      from auth.users u
    ),
    -- The live schema, not the migrations. Production has been observed to
    -- drift from supabase/migrations (see 20260803020000 and 20260805070000),
    -- so a backup that only pointed at the repo would describe a database
    -- that does not exist.
    'schema', jsonb_build_object(
      'columns', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'table', c.relname, 'column', a.attname, 'position', a.attnum,
          'type', format_type(a.atttypid, a.atttypmod),
          'not_null', a.attnotnull,
          'default', pg_get_expr(d.adbin, d.adrelid))
          order by c.relname, a.attnum), '[]'::jsonb)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
        left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
        where n.nspname = 'public' and c.relkind = 'r'
      ),
      'constraints', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'table', c.relname, 'name', con.conname,
          'definition', pg_get_constraintdef(con.oid))
          order by c.relname, con.conname), '[]'::jsonb)
        from pg_constraint con
        join pg_class c on c.oid = con.conrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
      ),
      'indexes', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'table', tablename, 'name', indexname, 'definition', indexdef)
          order by tablename, indexname), '[]'::jsonb)
        from pg_indexes where schemaname = 'public'
      ),
      'policies', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'schema', schemaname, 'table', tablename, 'name', policyname,
          'command', cmd, 'permissive', permissive, 'roles', roles::text,
          'using', qual, 'with_check', with_check)
          order by schemaname, tablename, policyname), '[]'::jsonb)
        from pg_policies where schemaname in ('public', 'storage')
      ),
      'rls_enabled', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'table', c.relname, 'enabled', c.relrowsecurity)
          order by c.relname), '[]'::jsonb)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
      ),
      'functions', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'schema', n.nspname, 'name', p.proname,
          'definition', pg_get_functiondef(p.oid))
          order by n.nspname, p.proname), '[]'::jsonb)
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('public', 'private') and p.prokind = 'f'
      ),
      'triggers', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'table', c.relname, 'name', tg.tgname,
          'definition', pg_get_triggerdef(tg.oid))
          order by c.relname, tg.tgname), '[]'::jsonb)
        from pg_trigger tg
        join pg_class c on c.oid = tg.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and not tg.tgisinternal
      ),
      'enums', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'name', t.typname,
          'values', (select jsonb_agg(e.enumlabel order by e.enumsortorder)
                       from pg_enum e where e.enumtypid = t.oid))
          order by t.typname), '[]'::jsonb)
        from pg_type t
        join pg_namespace n on n.oid = t.typnamespace
        where n.nspname = 'public' and t.typtype = 'e'
      )
    )
  );

  return payload::text;
end $$;

revoke execute on function public.export_database_backup() from public;
revoke execute on function public.export_database_backup() from anon;
revoke execute on function public.export_database_backup() from authenticated;
grant  execute on function public.export_database_backup() to service_role;

-- ----- Destination bucket ----------------------------------------------------
-- Private, and left with NO storage.objects policy on purpose. Every other
-- bucket in this project grants staff direct access; this one grants nobody.
-- The only key that can read or write it is the service-role key, which lives
-- in the server environment and never reaches a browser. An administrator who
-- can read every model's earnings still cannot download the whole database.
insert into storage.buckets (id, name, public)
values ('database-backups', 'database-backups', false)
on conflict (id) do nothing;

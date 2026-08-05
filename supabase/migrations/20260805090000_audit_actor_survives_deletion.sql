-- =============================================================================
-- KARAY Models — an audit row must outlive the person who wrote it
--
-- FOUND BY TESTING, not by reading. Deleting an administrator failed with
--
--   23502: null value in column "actor_id" of relation "system_audit_log"
--          violates not-null constraint
--   CONTEXT: UPDATE ONLY "public"."system_audit_log" SET "actor_id" = NULL
--
-- system_audit_log.actor_id was declared NOT NULL *and* carried
-- `references profiles(id) ON DELETE SET NULL`. Those two cannot both hold.
-- The foreign key's whole job is to blank the column when the profile goes;
-- the NOT NULL then rejects the blanking, and Postgres aborts the delete.
--
-- The effect: ANY account that had ever performed an audited action could not
-- be deleted at all. Not refused with a message — failed, at the database,
-- after passing every permission check the application makes. Deletions that
-- did succeed in the past succeeded only because those accounts had never
-- done anything; one of the old audit summaries even says so ("A conta não
-- havia criado nenhum registro"). At the time of this migration both
-- administrators on the system were undeletable for this reason.
--
-- So the owner held the permission, the RLS policy granted it, the server
-- action allowed it, and the database refused it anyway. That is the worst
-- shape a bug can take: it reads as a missing permission and sends people
-- looking for a way around the system.
--
-- NOT NULL is the half that is wrong. `actor_name` and `actor_role` are
-- stored on the row precisely so the record still names who acted after their
-- profile is gone — the id is the link, the name is the evidence. Dropping
-- NOT NULL lets the foreign key do what it always said it did, and the audit
-- trail keeps everything a reader actually needs.
--
-- video_approvals.approved_by had the identical contradiction. That table is
-- empty today, so nothing has hit it yet; it is fixed here rather than left
-- as the same bug waiting for its first row.
--
-- Verified against production inside an aborted transaction: owner deleting an
-- administrator who has written audit rows went from 23502 to rows=1, and the
-- administrator's audit entries survived with actor_name intact.
-- =============================================================================

alter table public.system_audit_log
  alter column actor_id drop not null;

alter table public.video_approvals
  alter column approved_by drop not null;

# Completion report — representative system, permissions, notes, onboarding

3 August 2026. Covers everything merged to `main` in this pass, on top of the
representative-system work that was already there.

---

## 1. Root causes discovered

| # | Symptom | Root cause |
| --- | --- | --- |
| 1 | "The Excluir button does not delete the note" | Not the API and not the RPC — both were verified working against production. The button called `window.confirm`, which a mobile in-app browser may suppress; a suppressed dialog returns `false`, so the click cancelled itself silently. |
| 2 | Representatives locked out of their own back office | `20260803000001` was never applied to the database, but its code shipped. Selecting `profiles.status` where the column does not exist fails the **entire query** with 42703 — it does not return a null field — so every guard reading it saw an empty row and refused access. |
| 3 | `/admin/pageview` failing in production (PGRST200 ×4) | `models.representative_id` had no foreign key, and PostgREST resolves embeds through foreign keys. `profiles!representative_id` could not be resolved, which failed the whole query. |
| 4 | Notes could not be created from four places | Those routes wrote `author_id` / `author_name` / `author_role`, columns that exist in the repo's schema but not in production. |
| 5 | "Último acesso" always read "Nunca" | `models.last_login_at` was rendered on three screens since launch and **nothing ever wrote it**. |
| 6 | Admins could delete accounts the UI reserved for the owner | `profiles` carried two DELETE policies; RLS policies are permissive, so the wider `profiles_delete_management` won. |
| 7 | A representative could rename herself | Self-update is permitted by RLS, and the guard trigger covered only role, status and active. |
| 8 | The migration itself could not be applied | Its first statement renames a function parameter (`target_model_id` → `target_model`), which Postgres refuses (42P13). |

## 2. Files changed

71 files, +5,594 / −5,369, across 23 commits (`fe75bf6..b91c0db`). The shape of it:

- **New screens** — `/admin/pageview`, `/admin/representatives/[repId]`, the view-as model and
  representative screens, the rep's onboarding screen as an admin preview.
- **New shared components** — `components/ui/ConfirmDialog`, `RepresentativeModelsDropdown`,
  `RepresentativeDashboardView`, `ViewAsBanner` (now a screen switcher).
- **New libraries** — `lib/auth/roles`, `lib/staff/representatives`, `lib/staff/profileLifecycle`,
  `lib/models/modelDashboardData.loadModelDashboard`.
- **Deleted** — seven components nothing imported (3,897 lines).
- **Docs** — this report, the permissions matrix, the dead-page audit, the assignment audit.

## 3. Database changes

All applied to production and recorded in `supabase_migrations.schema_migrations`.

| Migration | What it does |
| --- | --- |
| `20260803000001_representative_system` | The lifecycle columns (`status`, `phone`, `last_login_at`, `status_changed_*`), `manage_profile_columns`, refreshed `profiles` policies, `system_audit_log`, note soft-delete columns, the note policies, and the onboarding per-item rep lock. Written earlier, applied here after being made runnable. |
| `20260803020000_profiles_delete_owner_only` | Drops the wider delete policy; permanent deletion is the owner's alone in the database, not only in the UI. |
| `20260803030000_profile_name_change_is_staff_only` | Extends the guard so `full_name` cannot be changed by anyone but staff, on any row including one's own. |
| `20260803040000_models_representative_id_foreign_key` | The missing foreign key, `ON DELETE SET NULL`, plus a partial index. |

Not applied, deliberately: nothing. There is no pending migration.

## 4. Permissions added or changed

- Permanent account deletion: owner only, now enforced by RLS.
- `full_name`: staff only, enforced by trigger.
- Status / active: staff only; role: owner only (both already existed, both re-verified).
- Staff now outrank representatives in the *routing* layer too — an owner or administrator who
  opens a rep-only URL lands on the equivalent admin screen instead of being bounced to `/login`.
- Full matrix, with the file and policy behind every row: `docs/permissions-matrix.md`.

## 5. Routes and APIs changed

New: `/admin/pageview`, `/admin/representatives/[repId]`, `/admin/view-as/model/[modelId]`,
`/admin/view-as/model/[modelId]/representative`, `…/representative/onboarding`,
`/api/auth/record-login`.

Changed: `/admin/models` (rep view + model view per row, Pageview link, rep section with a models
dropdown), `/admin/users/new` (representative assignment on model creation),
`/api/admin/users` (accepts and validates `representativeId`), `/api/models/notes` (authorship
columns), `/api/representatives/public` (filters on `active`), `proxy.ts` (same).

Redirect kept for compatibility: `/admin/view-as/representative/[repId]/models/[modelId]`.

## 6. Security protections added

- Deletion locked to the owner at the database layer.
- Profile names locked to staff, so audit trails cannot be rewritten by their subject.
- Inactive and archived accounts have their sessions terminated on status change.
- View-as never mints a token or swaps a session: it renders the other person's screen under the
  admin's own RLS, with acting controls removed and both entry and exit logged.
- Two audit trails, readable by staff and writable by no session at all.

## 7. Bugs fixed

Note deletion (the reported one) · six further `window.confirm` / `window.prompt` dialogs with the
same defect · the rep lockout · the Pageview query failure · note creation from four routes ·
`last_login_at` never written · admin-deletable accounts · self-rename · the un-runnable migration ·
view-as screens that were stale replicas (the model one exposed internal notes she never sees) ·
no way to assign a representative when creating a model.

## 8. Test accounts and scenarios used

No browser logins were available, so authorization was tested **directly against production** by
assuming each role's identity (`request.jwt.claims` + `set local role authenticated`, RLS active,
service-role bypass off). Every write ran inside a transaction that was aborted afterwards —
verified by re-reading the rows.

Roles exercised: owner, administrator, representative A (9 models), representative B (0 models),
model. Scenarios: cross-representative access by direct id, onboarding item visibility, note
reading and writing, authorship forging, self-promotion, self-reactivation, archiving others,
deleting others, the onboarding lock in both directions, and staff override.

## 9. Test results

28 checks, 26 passing on the first run. The two failures — admin-deletable accounts and rep
self-rename — were fixed, migrated and re-tested green. Detail in `docs/dead-page-audit.md`.

Every build in this pass: `tsc --noEmit` clean, `next build` compiled, 249/249 tests passing,
ESLint 0 errors. Production runtime errors: none in the three hours after the last deploy.

## 10. Dead or obsolete pages discovered

`docs/dead-page-audit.md` lists every route and component with its evidence. Highlights: seven
components with no importer, `/portal` unreachable from navigation but a sound post-login
fallback, `/owner/users*` overlapping the new rep screens, and a public help page with no inbound
link.

## 11. Items removed after approval

- The seven unreferenced components (recoverable: `git checkout be7a8ea -- <path>`).
- Four accounts, each checked for references first and each refused if anything had depended on it:
  the production test administrator, both duplicate "Alex Harris" representatives, and the
  "Kartel West" representative account. All four are recorded in `system_audit_log`; the nine
  models that hung off the last one are listed in its `previous_value` for reassignment.

## 12. Items retained and why

`/portal`, `/owner`, `/administrator` — unreachable or trivial, but they are redirect targets that
logins and old bookmarks rely on. `/owner/users*` — still the only place to reset a password or
change a role. The Amplia portal, the Claude assistant and the PDF importer — all linked and in
use. Nothing else was removed.

## 13. Known limitations

1. **No UI testing.** Everything verified here is server-side: RLS, triggers, policies, routes. A
   forged request cannot get past the database — but no screen has been clicked through as a real
   user, on desktop or mobile.
2. **No representatives exist.** All three accounts were deleted at the owner's instruction, so all
   16 models are unassigned and the rep back office, view-as and onboarding lock have nobody to
   apply to until one is created.
3. **Two role enums.** Migrations declare `public.management_role`; production has
   `public.app_role`. New SQL must use the production name or plain `text`.
4. **Representative notes are unproven in practice** — the policies test correctly, but no rep has
   ever written one.
5. `system_audit_log` does not yet cover note creation and editing, permission changes, or refused
   access attempts.

## 14. Recommended future improvements

- Create a real representative and walk one model through onboarding end to end; it is the one
  path that has never run for real.
- Fold password reset and role change into the rep profile, then retire `/owner/users*`.
- Reconcile the enum divergence.
- Extend `system_audit_log` to the remaining actions in spec §13.
- Backfill `profiles.email` — most accounts have none, which makes the assignment dropdown harder
  to read than it should be.

## 15. Rollback instructions

**Code.** `main` is linear; every commit is independent.
`git revert <sha>` for one change, or `git revert --no-commit fe75bf6..b91c0db && git commit` for
the lot. Deleted components come back with `git checkout be7a8ea -- <path>`.

**Database.** Each migration reverses cleanly, and none drops data:

```sql
-- 20260803040000
alter table public.models drop constraint models_representative_id_fkey;

-- 20260803030000: restore the previous manage_profile_columns body without the
-- full_name branch (the migration file quotes it in full).

-- 20260803020000
create policy profiles_delete_management on public.profiles
  for delete to authenticated using ( private.is_management() );

-- 20260803000001: the lifecycle columns are additive. Dropping them means
-- dropping profiles.status, which the application now reads — revert the code
-- first, or leave the columns in place.
```

**Deleted accounts cannot be rolled back.** They are gone from `auth.users` and `public.profiles`;
what survives is the `system_audit_log` row for each, including the nine model assignments recorded
against "Kartel West".

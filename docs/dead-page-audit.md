# Dead page / dead feature audit

Nothing in this report has been deleted. It is a list of findings with the evidence behind each one,
for the owner to decide on.

Method: every route under `app/` was enumerated, then reference-counted across `app/`, `components/`
and `lib/` (imports, `href=`, `redirect()` targets, `fetch()` call sites). "No inbound link" means no
navigation reaches it; it does **not** mean nothing depends on it — several of these are redirect
targets that logins rely on.

## Pages

| Item | Path | Current purpose | Evidence of usage | Problem | Recommendation | Risk of removal |
| --- | --- | --- | --- | --- | --- | --- |
| Owner landing | `/owner` | 4-line file, redirects to `/admin/models` | 10 references to `/owner*` | Does nothing on its own | Keep | Medium — old bookmarks/links |
| Administrator landing | `/administrator` | Redirects to `/admin/models` | 2 references | Same | Keep | Medium |
| Portal | `/portal` | Sends each role to its own home | **0 inbound links** | Unreachable from the UI | Keep, hide from nav | Medium — good post-login fallback |
| Owner user management | `/owner/users`, `/owner/users/[id]`, `/owner/users/new` | Account management, owner-only | Linked from `/admin/models` and now `/admin/representatives` | Overlaps the new `/admin/representatives` for reps; still the only place to reset a password or promote to admin | **Merge** — fold password reset + role change into the rep profile, then retire | High until merged |
| Rep view of a model (old) | `/admin/view-as/representative/[repId]/models/[modelId]` | Was a hand-written replica of the rep's model screen | Was linked from the rep view-as list | Replica had drifted from the real screen | Already **repaired**: now redirects to `/admin/view-as/model/[modelId]/representative` | Low |
| Google Photos guide | `/como-compartilhar-google-photos` | Public help page | **0 inbound links** | Unreachable | Requires owner decision — link it from onboarding or archive | Low |
| Recording guidelines | `/diretrizes-de-gravacao` | Public help page | 1 reference (model dashboard) | None | Keep | — |
| Amplia portal | `/admin/socialmediamodels/**` | Brand-growth product | Linked from `AdminHeader` | None found | Keep | — |
| Claude assistant | `/admin/assistant` | Chat assistant | 1 link from `/admin/models` | None found | Keep | — |
| PDF/image importer | `/admin/import` | Bulk model import | 1 link from `/admin/models` | None found | Keep | — |

## Components with no importer

Reference-counted by import specifier across the whole tree. All seven are dead code today; none is
referenced by any page, API route or other component.

| Component | Overlaps / replaced by | Recommendation |
| --- | --- | --- |
| `components/admin/ModelNotesAndTasks.tsx` | `components/admin/model/NotesTab.tsx` | Candidate for deletion — duplicate of the live notes UI, and the one that still contains the old delete flow |
| `components/admin/model/DriveTab.tsx` | `components/admin/MediaDrivePanel.tsx` / `MediaDrivePanel` | Candidate for deletion |
| `components/admin/model/GoogleDriveTab.tsx` | as above | Candidate for deletion |
| `components/admin/MediaDrivePanel.tsx` | superseded by the media panel in `ModelAdminClient` | Requires owner decision |
| `components/admin/model/FanslyTab.tsx` | `FanslyBackofficePanel` | Candidate for deletion |
| `components/admin/FanslyBackofficePanel.tsx` | — | Requires owner decision — Fansly back-office may be planned work |
| `components/admin/EditableModelInfo.tsx` | `ModelAdminClient` inline editing | Candidate for deletion |

## Behaviour found broken or half-wired

| Item | Finding | Status |
| --- | --- | --- |
| `models.last_login_at` | Rendered on three screens since launch; **nothing ever wrote it**, so it was always "Nunca" | **Fixed** — `/api/auth/record-login` now stamps it (and `profiles.last_login_at`) after each sign-in |
| Note deletion | The API and the `delete_model_note` RPC both work (verified against production with a throw-away note inside an aborted transaction). The buttons used `window.confirm` / `window.prompt`, which mobile in-app browsers may suppress — a suppressed dialog returns nothing, so the click silently did nothing | **Fixed** — in-page confirmation modal over the soft-delete and purge flows, with loading, success and error states |
| Representative assignment | An admin creating a model had **no way to assign a representative**; only the public `/aplicar` referral path and the PDF importer ever set `representative_id` | **Fixed** — assignment dropdown on the model creation form, active accounts only, server-validated |
| Rep view-as screens | Were hand-written replicas; the model one even showed internal notes the model never sees | **Fixed** — both now render the real components through the real loaders |
| `window.confirm` elsewhere | Same suppression risk in `MediaDrivePanel`, `ModelEarningsPanel`, `LedgerPanel` | Open — recommend the same modal treatment |
| Two role enums | Migrations declare `public.management_role`; production actually has `public.app_role` (4 labels, `management_role` absent). SQL written against the repo's name would fail on production | Open — worth reconciling before the next function migration |
| Missing foreign key | `models.representative_id` has **no FK** in production (only `profile_id` and `created_by` do). PostgREST therefore cannot resolve `profiles!representative_id` embeds — it answered PGRST200 and failed the whole query — and deleting a representative does not null out her models | Partly fixed — the embed was replaced with a second query, and the delete path clears assignments itself. Adding the constraint is still recommended |
| Unapplied migration | `20260803000001_representative_system.sql` was **not applied to production** when its code went live: `/api/representatives/public` logged `column profiles.status does not exist` | **Applied** — profiles lifecycle columns, `system_audit_log`, note soft-delete columns, the new note policies and the onboarding rep-lock trigger are all live, and the migration is recorded in `supabase_migrations.schema_migrations` |
| Migration was not re-runnable | Its `create or replace function is_assigned_representative(target_model uuid)` clashes with production's `(target_model_id uuid)` — Postgres refuses to rename an input parameter (42P13), and dropping the function would take every dependent RLS policy with it | **Fixed** — the function is now created only where it is absent, and left untouched where it already exists |

## Role testing (production, every write rolled back)

20 authorization checks run as each real role, with RLS active:

Passing — a representative sees only her assigned models and nothing when she
addresses another rep's model by id; she cannot read that model's onboarding
items, cannot read staff notes, cannot write a note on a model that is not
hers, cannot forge a staff member's authorship, cannot promote herself, cannot
archive or delete another account, and cannot reactivate herself once
deactivated (42501 from `manage_profile_columns`). Deactivating a rep flips
`active` automatically. A model sees only her own record. An administrator can
archive a rep but cannot promote anyone to owner. Owner and admin see all 16
models.

| Gap found | Severity | Status |
| --- | --- | --- |
| An administrator could DELETE a profile row directly — permanent deletion is owner-only in the UI, but `profiles` carried a second, wider delete policy (`profiles_delete_management`) | High — bypassed the rule by calling the API directly | **Fixed** in 20260803020000; re-tested (admin rows=0, owner rows=1) |
| A representative can rename her own profile (`full_name`) — self-update is permitted, and only status/active/role are guarded | Low — her name is what appears in audit trails | Open — awaiting a decision |

## Deleted in this pass

Nothing.

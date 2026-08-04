# Delivery report — navigation, representative management, onboarding and Drive folders

4 August 2026. Covers the twelve-part request of the same date, on branch
`claude/remaining-work-percentage-e11wnc`.

---

## 1. What each requested item turned into

| # | Request | Outcome |
| --- | --- | --- |
| 1 | Navigation to `/admin/representatives` | Real nav bar in the admin header, staff-only, with active state |
| 2 | Replace "Gerenciar" with "Excluir Rep" | Done, plus the guard the old flow's dialog wrongly promised |
| 3 | Edit representative credentials | New route + panel, mirroring the model credential flow |
| 4 | Second optional e-mail in onboarding | New self-completing step with a tri-state |
| 5 | Verify the Drive folder reaches the model | Verified; one real defect found and fixed (see §5) |
| 6 | Second Drive folder for Instagram | Surfaced an existing column on both sides; no new column |
| 7 | Representative notes | Existed; extended so a rep can correct her own note |
| 8 | Record every onboarding change | Existed; now carries previous values and skips no-ops |
| 9 | Replace the broken Dashboard tab | Removed, replaced by Pageview, and `/admin` no longer 404s |
| 10 | Permission rules | Enforced server-side and in the database; `docs/permissions-matrix.md` updated |
| 11 | Database and migrations | One migration, additive and reversible (§8) |
| 12 | Testing | §9 — and read §10 first for what was *not* tested |

## 2. Files changed

30 files: 23 modified, 7 added.

**Added**

- `app/admin/page.tsx` — `/admin` redirects to the model list instead of answering 404.
- `app/admin/representatives/[repId]/RepresentativeCredentialsPanel.tsx`
- `app/api/admin/representatives/credentials/route.ts`
- `components/admin/DeleteRepresentativeButton.tsx`
- `lib/models/driveFolder.ts`
- `supabase/migrations/20260804000000_representative_notes.sql`
- `tests/drive-folder.test.ts`, `tests/onboarding-secondary-email.test.ts`

**Modified**

- Navigation — `app/admin/AdminHeader.tsx`, `app/admin/layout.tsx`,
  `app/admin/models/page.tsx`, `app/admin/pageview/page.tsx`
- Representatives — `app/admin/representatives/actions.ts`,
  `app/admin/representatives/RepresentativesClient.tsx`,
  `app/admin/representatives/[repId]/page.tsx`,
  `app/admin/users/new/NewUserForm.tsx`, `app/api/admin/users/route.ts`
- Onboarding — `lib/onboarding/definition.ts`, `lib/onboarding/server.ts`,
  `app/api/models/onboarding/route.ts`,
  `components/onboarding/OnboardingChecklistPanel.tsx`
- Drive folders — `lib/models/modelDashboardData.ts`, `types/modelDashboard.ts`,
  `components/admin/model/OverviewTab.tsx`,
  `components/model-dashboard/ModelDashboardView.tsx`,
  `app/api/models/update/route.ts`, `lib/googleDrive.ts`
- Notes — `app/api/models/notes/route.ts`, `components/admin/model/NotesTab.tsx`
- Audit — `lib/audit/auditLogger.ts`
- Docs — `docs/permissions-matrix.md`

## 3. Navigation (items 1 and 9)

`/admin` never had a page. The "Dashboard" tab pointed at it from both
`/admin/models` and `/admin/pageview`, and both answered 404. Hiding the tab
would have left the address broken, so:

- `app/admin/layout.tsx` became a server component that reads the viewer's role
  once and hands it to the header. It is not an access check — every page under
  `/admin` still redirects on its own, and a layout cannot redirect for the page
  it wraps.
- The header now carries **Modelos · Representantes · Pageview · Amplia**, drawn
  only for `owner` and `administrator`, with the active tab marked (including on
  nested routes, so `/admin/representatives/<id>` still highlights
  Representantes) and `aria-current="page"` set.
- Both dead "Dashboard" links are gone. `/admin` itself redirects to
  `/admin/models`, so old bookmarks land somewhere real.

`/admin/representatives` was reachable only by typing the URL. It now has a
link, and the page's own owner/administrator guard is unchanged.

## 4. Excluir Rep (item 2)

The per-row "Gerenciar conta" link in the Representantes section of
`/admin/models` is replaced by **Excluir Rep**, owner-only. The section's
"Gerenciar representantes →" link was relabelled "Ver todos os representantes →"
so no "Gerenciar" button remains in that section while the way to the screen
stays.

The button is one shared component, now used on `/admin/models` and on
`/admin/representatives`, and it will not:

- **Delete a representative who still holds models.** `models.representative_id`
  is `ON DELETE SET NULL`, so deleting the profile would silently unassign them.
  The dialog says how many there are and links to the profile to reassign first;
  the server action refuses the same case independently.
- **Fire twice.** Button and confirm are both disabled while the action is in
  flight, and the dialog closes only on success.
- **Delete anonymously.** The representative's name is in the dialog and
  `EXCLUIR` must be typed.

The old dialog on `/admin/representatives` claimed assigned models "continuam no
sistema, mas ficam sem representante" — which the server action has always
refused to do. That copy is gone.

`deleteRepresentative` now writes a `representative_deleted` row to
`system_audit_log` with the representative's name, the actor and the timestamp.
That row outlives the profile: `system_audit_log.target_id` carries no foreign
key.

## 5. Google Drive folders (items 5 and 6)

**Item 5, verification.** The admin Resumo tab writes `models.content_drive_url`
through `/api/models/update`; the model, her representative and both admin
previews all read it through one shared column list
(`DASHBOARD_MODEL_COLUMNS` in `lib/models/modelDashboardData.ts`). One column,
one record, four screens — there is no second store to drift. All four pages are
`force-dynamic`, so a change is visible on the next load. Clearing the field
empties it, and both the model's link and the upload button fall back to the
empty state rather than showing a stale folder. `/api/models/update` refuses any
role but owner and administrator, and the model-facing screen has no editor at
all.

**One real defect found.** Nothing validated the value. A typo saved cleanly and
became a dead link on the model's screen, and `/api/models/drive-upload` could
not resolve a folder ID from it — so uploads failed with no indication why.
`lib/models/driveFolder.ts` now holds the parser (moved out of
`lib/googleDrive.ts`, which is `server-only` and could not be used by the admin
screens), and `/api/models/update` and the onboarding route both reject a value
that cannot be resolved to a folder ID. An empty value stays valid: that is how
a folder is removed.

**Item 6.** `models.drive_instagram` already existed and was admin-only. Rather
than adding a column, it is now carried to the model side as
`driveInstagramUrl`. Both folders appear on the admin Resumo tab and on the
model-facing area, each labelled and described so they cannot be confused:

- **Google Drive / Conteúdo** — "Onde o seu conteúdo é enviado."
- **Google Drive / Instagram** — "Material do seu Instagram."

Each shows its own empty state when unassigned. Neither is editable by a model
or a representative. Both are separate columns; neither can overwrite the other.

## 6. Secondary e-mail (item 4)

A new onboarding step, `model_information.secondary_email`, with two fields: an
optional e-mail and a "Não se aplica / pular e-mail secundário" checkbox.

The step never gets ticked by hand — it derives its state from those two fields,
which is what lets the system tell the three cases apart:

| State | Meaning | Counts towards the percentage |
| --- | --- | --- |
| `completed` | an e-mail was entered | yes |
| `skipped` | the skip box was ticked | yes |
| `pending` | neither | no |

The percentage is maintained by `trg_onboarding_progress`, which counts
`completed` rows — so a skipped step writes `completed = true` and reads
correctly, while the screen still shows "Não se aplica" rather than "Preenchido".

The two fields are mutually exclusive and the **server** keeps them that way, so
a direct API call cannot leave the pair in a state the UI never shows: entering
an e-mail clears the skip box, and ticking the skip box clears the e-mail.
Because ticking it discards an e-mail already on file, the UI confirms first —
in-page, not `window.confirm`, which mobile in-app browsers may suppress. The
e-mail field is validated for format and disabled once the step is skipped.

Stored in `model_onboarding_items.field_values`, the mechanism the schema
already has for a value belonging to one step — so item 4 needed no migration.
**Assumption:** the request said "under the onboarding status information", so
this is treated as onboarding data rather than a new column on `models`. If it
should also appear on the Resumo tab and be queryable, say so and it becomes a
linked field with a one-column migration.

The suggested labels were given in English; they are rendered in pt-BR to match
the rest of the admin.

## 7. Notes and onboarding history (items 7 and 8)

**Item 7.** Representative notes already existed — reps write them on their
assigned models from the same panel the owner and admins read, notes carry
author name, role, created and last-updated timestamps, deletion is soft and
owner-only, and the confirmation is already an in-page modal. Two gaps were
real, and both are fixed:

- A rep could write a note and never correct a typo in it. She may now edit her
  own, non-deleted note on a model still assigned to her — and only the *text*:
  `guard_note_representative_update` refuses any change to authorship, to which
  model the note belongs, to pinned/archived, to the soft-delete columns, or to
  a ledger note's link. Administrators still may not edit notes; only the owner
  and the note's author can.
- A rep's note was created with no `model_note_history` row, because that insert
  was staff-only under RLS. Every note is now recorded, whoever wrote it, and
  every edit stores the body it replaced — an edit adds to the record rather
  than replacing it.

The last-edit line in the notes panel now names the editor's role as well as
their name.

**Item 8.** Onboarding changes were already recorded server-side by every actor
who can make one (staff and the assigned representative; a model cannot edit
onboarding at all). Three things were missing:

- `previousValue` was always `null` for field edits. Every audit row now carries
  the value being replaced, read before the write.
- Saving a form that changed nothing still wrote a history row. A write whose
  value is unchanged is now skipped entirely — no update, no audit row.
- A step moving between completed / skipped / pending had no record of its own.
  It now writes one naming both states.

`model_audit_history` was already append-only for every session: `authenticated`
holds only SELECT and INSERT, and no UPDATE or DELETE policy exists. Nothing was
needed there.

## 8. Database migrations

One migration: `supabase/migrations/20260804000000_representative_notes.sql`.

| Change | Reversible by |
| --- | --- |
| `notes_update` also admits a rep editing her own, non-deleted note | Recreating the staff-only policy quoted in the file header |
| `guard_note_representative_update` trigger + `trg_note_representative_update` | `drop trigger` / `drop function` |
| `note_history_insert` also admits an assigned rep | Recreating `note_history_insert_staff_only` |

It adds no column, drops nothing, deletes no data and touches no existing row —
it is policies and one trigger. Rolling it back returns note editing to
owner-only without any data migration.

```sql
-- Rollback
drop trigger if exists trg_note_representative_update on public.model_notes;
drop function if exists public.guard_note_representative_update();

drop policy if exists notes_update on public.model_notes;
create policy notes_update on public.model_notes
  for update to authenticated
  using ( public.is_staff() ) with check ( public.is_staff() );

drop policy if exists note_history_insert on public.model_note_history;
create policy note_history_insert_staff_only on public.model_note_history
  for insert to authenticated
  with check ( public.is_staff() );
```

Two schema notes carried forward from earlier work and respected here: the live
database uses `public.app_role`, not `public.management_role`, so this migration
declares no enum; and `is_assigned_representative`'s argument is passed
positionally, because production names it `target_model_id` while a fresh
database names it `target_model`.

**No migration was needed for items 4 and 6.** The secondary e-mail lives in
`field_values`, and `drive_instagram` is an existing column that already holds a
column-level SELECT grant for `authenticated` — the allowlist in
`20260724000002` / `20260731000000` covers it, so nothing had to be regenerated.

## 9. New environment variables

None. No new service, key or configuration is introduced.

## 10. Routes added, removed and changed

**Added:** `/admin` (redirect), `/api/admin/representatives/credentials`.

**Removed:** none. The two dead links to `/admin` are gone, but the address
itself now resolves.

**Changed:** `/admin/models` (nav link removed, Excluir Rep replaces Gerenciar
conta, section link relabelled), `/admin/pageview` (Dashboard link replaced by
Representantes), `/admin/representatives/[repId]` (credentials section),
`/api/admin/users` (accepts a username for staff accounts, writes
`profiles.email`, requires a password change at a representative's first login),
`/api/models/update` (Drive folder validation), `/api/models/onboarding`
(checkbox fields, derived completion, previous values, no-op suppression,
validation), `/api/models/notes` (rep may edit her own note; history recorded
for every author).

## 11. Testing — and what was not tested

**Ran, all green:**

| Check | Result |
| --- | --- |
| `tsc --noEmit` | clean |
| `next build` | compiled, 26/26 pages generated |
| `eslint` | 0 errors (9 warnings, all pre-existing) |
| `npm test` | 273/273 passing, up from 257 |

16 new unit tests: the secondary e-mail's tri-state in every combination
(including whitespace, a non-`true` token, and the both-set case), the
requirement that a derived step's fields stay unlinked, and Drive folder parsing
across folder URLs, `open?id=` URLs, bare IDs, junk and the empty value.

**Not tested, and this matters:** no screen was clicked through, and nothing was
run against the production database. This environment has no browser session and
no Supabase credentials, so the acceptance criteria that require a logged-in
user — the nav link opening the page, an unauthorized user being turned away,
the confirmation dialogs appearing, the percentage moving, a model seeing the
Instagram folder, mobile layout — are **verified by reading the code and by the
build, not by using the application.** The migration has not been applied to any
database.

The three that need a real run before this is trusted in production:

1. Apply `20260804000000_representative_notes.sql`, then have a representative
   edit her own note (should succeed) and try to unarchive or un-delete one
   (should fail with a clear message).
2. Walk one model's onboarding: enter a secondary e-mail, watch the percentage
   move, clear it, tick "não se aplica", confirm the percentage is the same in
   both cases and that the history shows all three transitions.
3. Change a representative's password and confirm she is sent to
   `/alterar-senha` at her next login and her old session is dead.

There are no screenshots for the same reason.

## 12. Risks and assumptions

1. **The onboarding step count changed.** Every model whose onboarding is not
   complete gains one step, so her percentage moves down slightly until it is
   answered — one click, since "não se aplica" completes it. Models already at
   100% are untouched: `syncOnboardingItems` does not seed into a locked
   onboarding, by existing design.
2. **Representatives now must change their password at first login.**
   `must_change_password` was previously set for models only. Any representative
   created from now on, and any whose password an admin changes, is sent to
   `/alterar-senha` once. Existing representatives are unaffected — no existing
   row was updated.
3. **Usernames share one login namespace with models.** A representative's
   username is registered under the same reserved domain a model's is, so a
   username already taken by a model is refused with "já está em uso". That is
   correct behaviour, but it is worth knowing why the message appears.
4. **The admin layout now issues one profile read per navigation.** Every page
   under `/admin` already did the same read; this adds one more.
5. **Administrators can edit representative credentials.** The request asked for
   this ("Can edit representative credentials when authorized"). It means an
   administrator can take over a representative's account by setting its
   password. Deletion stays owner-only. If credential editing should also be
   owner-only, it is a one-line change in the route.
6. **`/api/models/update` field names are unchanged**, so nothing that already
   wrote `contentDriveUrl` is affected by the new validation except that an
   unparseable value is now rejected instead of silently stored.

## 13. What was not touched

No unrelated feature was modified. The earnings ledger, the Amplia portal, the
Claude assistant, the PDF importer, the applicant intake, view-as, and every
model-facing screen other than the Drive folder block are untouched. No account,
model or note was deleted, and no production data was written from this work.

# Permissions matrix

The rule this codebase enforces, in one line: **owner ≥ administrator > representative > model.**
Anything a representative may see or do on a model, staff may too. The reverse is never true.

Where each rule lives — every row is enforced in at least two independent layers, so a policy
relaxed by mistake in one place does not silently open the system:

| Layer | File(s) |
| --- | --- |
| Page guard | each `app/**/page.tsx` (role read from `profiles`, `redirect()` on refusal) |
| API route | `lib/api/requireRole.ts` (`requireStaff`, `requireModelAccess`), per-route checks |
| Shared role helper | `lib/auth/roles.ts` (`STAFF_ROLES`, `isStaffRole`) |
| Middleware | `proxy.ts` (route guards by role and representative status) |
| Onboarding | `lib/onboarding/server.ts` (`resolveOnboardingAccess`) |
| Database | RLS policies + `public.is_staff()` / `public.is_owner()` / `public.is_active_user()` |

## Accounts

| Action | Owner | Administrator | Representative | Model |
| --- | --- | --- | --- | --- |
| View all representatives | Yes | Yes | No | No |
| Create representative | Yes | Yes | No | No |
| Activate / deactivate representative | Yes | Yes | No | No |
| Archive / restore representative | Yes | Yes | No | No |
| Permanently delete representative | Yes | No — archive instead | No | No |
| Manage administrators | Yes | No | No | No |
| Change own account status | No (nobody may, from these screens) | No | No | No |

Enforcement: `app/admin/representatives/actions.ts` (server actions: `updateRepresentativeStatus`,
`deleteRepresentative`, `viewAsRepresentative`), the `manage_profile_columns` trigger (role changes
owner-only, status/active changes staff-only, enforced in the database), and the
`profiles_update` / `profiles_delete` RLS policies.

Lifecycle storage: `profiles.status` holds `ativa` | `inativa` | `arquivada`, and the trigger keeps
`profiles.active` in step for representatives — so the status can never disagree with whether the
account may log in, which is the column every gate reads.

## Models

| Action | Owner | Administrator | Representative | Model |
| --- | --- | --- | --- | --- |
| View all models | Yes | Yes | No | Own record only |
| View assigned models | Yes | Yes | Assigned only | Own record only |
| Assign a representative to a model | Yes | Yes | No | No |
| Change model status | Yes | Yes | No | No |
| Complete onboarding | Yes (also after completion) | Yes, until complete | Assigned models, until complete | No |
| Upload content to Drive | Yes | Yes | Assigned models | Own folder |
| Edit own avatar | — | — | No | Yes |

Enforcement: `models_select` RLS (`is_management() OR is_own_model() OR is_assigned_representative()`),
`requireModelAccess`, `resolveOnboardingAccess`, `/api/models/status`, `/api/models/drive-upload`.

## Notes

| Action | Owner | Administrator | Representative | Model |
| --- | --- | --- | --- | --- |
| Read internal notes | Yes | Yes | No | No |
| Create internal note | Yes | Yes | No | No |
| Edit note | Yes | No | No | No |
| Pin / archive note | Yes | Yes | No | No |
| Soft-delete (archive) a note | Yes | Yes | No | No |
| Purge a note permanently | Yes | No | No | No |
| Read ledger notes (expenses/loans) | Yes | Yes | Assigned models | Own record |

Enforcement: `notes_staff_only_access` migration (staff-only RLS), `notes_delete_owner` policy +
`public.delete_model_note()` RPC (`is_owner()` check inside the function), `/api/models/notes`
(`allowedRoles`, `profile.role !== "owner"` on DELETE for the permanent purge).

Representative notes: a rep may write a note on a model assigned to them and read back their own —
never an owner's, an admin's, or another representative's. Rep-authored notes flow into the same
central notes and history area the owner and admins read.

Removal is two-step: soft-delete archives the note (owner and admins), and only the owner may purge
it from the database afterwards. Both steps confirm in an in-page modal — never `window.confirm` or
`window.prompt`, which mobile in-app browsers may suppress.

## View-as

| Action | Owner | Administrator | Representative | Model |
| --- | --- | --- | --- | --- |
| View as representative | Yes | Yes | No | No |
| View as model | Yes | Yes | No | No |
| Act while in view-as | Never — see below | Never | — | — |

`/admin/view-as/**` renders the other person's real screen while the admin keeps their own session:
no impersonation token is minted, no session is swapped, every query still runs under the admin's own
RLS. Acting controls are removed in preview (`previewMode` in `ModelDashboardView`: no logout button,
no Drive upload), and a persistent banner names whose screen is on display with a way back.

Entering and leaving a rep's back office both write to `public.system_audit_log`
(`view_as_representative_enter` / `_exit`) — who looked, at whom, when.

## Audit trails

| Trail | Table | Written by |
| --- | --- | --- |
| Everything about one model | `model_audit_history` | `lib/audit/auditLogger.ts` (`logAuditEntry`), DB RPCs |
| Account lifecycle, note removal, view-as | `system_audit_log` | `lib/audit/auditLogger.ts` (`logSystemAuditEntry`) |

Both logs are readable by staff and writable by nobody from a session: a representative can neither
forge an entry nor erase one.

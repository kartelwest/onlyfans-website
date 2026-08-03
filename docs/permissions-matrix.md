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

Enforcement: `app/api/admin/users/[userId]/route.ts` (`authorize()` — target role, self-target and
owner-target checks), `app/admin/representatives/**` for the interface, `profiles.active` as the one
column every login gate reads.

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
| Delete any note | Yes | No | No | No |
| Read ledger notes (expenses/loans) | Yes | Yes | Assigned models | Own record |

Enforcement: `notes_staff_only_access` migration (staff-only RLS), `notes_delete_owner` policy +
`public.delete_model_note()` RPC (`is_owner()` check inside the function), `/api/models/notes`
(`allowedRoles`, `profile.role !== "owner"` on DELETE).

Not yet built (spec §7): representative-authored notes flowing into the central history. Decided
behaviour for when it lands — a rep may read back the notes **they** wrote on **their** models, and
never an owner's, an admin's, or another rep's.

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

Opening a rep's back office writes `view_as_representative` to `public.staff_audit_log`
(who looked, at whom, when).

## Audit trails

| Trail | Table | Written by |
| --- | --- | --- |
| Everything about one model | `model_audit_history` | `lib/audit/auditLogger.ts`, DB RPCs |
| Account lifecycle + view-as | `staff_audit_log` | `lib/audit/staffAudit.ts` (service role only) |

`staff_audit_log` grants `authenticated` SELECT and nothing else, and its RLS restricts even that to
staff: a representative can neither forge an entry nor erase one.

# Representative assignment audit

Read-only report, taken from production. Nothing was reassigned, renamed, archived or
deleted — spec §10 asks for the findings first.

## Integrity: clean

| Check | Result |
| --- | --- |
| Models pointing at an account that no longer exists | 0 |
| Models assigned to someone who is not a representative | 0 |
| Models assigned to an inactive or archived representative | 0 |
| Models with more than one representative | Not possible — a single `representative_id` column |

## Distribution: lopsided

16 models, 3 representative accounts.

| Representative | E-mail | Models | Note |
| --- | --- | --- | --- |
| ~~Kartel West~~ | — | 9 → 0 | Deleted 3 Aug 2026; its 9 models were unassigned first |
| ~~Alex Harris~~ | alexharris@karraymodels.com | 0 | Deleted 3 Aug 2026 |
| ~~ALEX HARRIS~~ | — | 0 | Deleted 3 Aug 2026 |

**There are now no representative accounts, and all 16 models are unassigned** — the owner's
decision, to be rebuilt deliberately. The nine models that were attached to the deleted
account are listed in its `system_audit_log` row (`previous_value`), so the old distribution
can be read back at any time.

Until a representative exists and is assigned, the rep back office, the rep view-as preview
and the onboarding lock have nobody to apply to.

At the time of the audit, 7 of 16 models had no representative — that is now all 16. These
seven were the ones that never had one:

| # | Model | Status | Onboarding | Has login |
| --- | --- | --- | --- | --- |
| 7 | Tainara de Mesquita Lima | active | 0% | no |
| 9 | Raíssa de Sousa Viera | active | 23% | yes |
| 11 | Rogéria Sousa de Mesquita | active | 0% | no |
| 21 | Juliana a | active | 0% | yes |
| 17 | Adria Raquel Siqueira Santos | candidate | 0% | no |
| 19 | Jamilly | inactive | 0% | yes |
| 20 | Vanessa | inactive | 0% | yes |

Raíssa (#9) is the one that matters most: she is the only model with onboarding under way
(7 of 31 steps) and she has a portal login, but no representative — so nobody sees her in a
rep back office, and the onboarding lock has never applied to her.

## Accounts worth a decision

1. ~~Duplicate representative~~ — **both deleted, on the owner's instruction.** "Alex
   Harris" (20 Jul, alexharris@karraymodels.com) and "ALEX HARRIS" (22 Jul, no e-mail)
   were removed permanently on 3 Aug 2026, logins included. Neither held a model and
   neither had created anything — zero rows across every table referencing `profiles` —
   so nothing historical was lost. Both deletions are in `system_audit_log`.

2. ~~The rep carrying the roster may be you~~ — **deleted, on the owner's instruction.**
   "Kartel West" (no e-mail) was a second representative account alongside the owner's own.
   It was removed permanently on 3 Aug 2026; its 9 model assignments were cleared
   explicitly first, since production has no foreign key on `models.representative_id` to
   do it. It had created nothing else anywhere. The nine models are recorded in the audit
   row for reassignment.

3. ~~A model also holds an administrator account~~ — **intended, confirmed by the owner.**
   "Raíssa de Sousa Vieira" (albetiza.teamo.123@gmail.com) is an administrator who is also
   model #9; the two are deliberately separate accounts, and the model area is reached
   through its own sign-in. Her admin account can read every model's data, which is what
   being an administrator means — noted here so the pairing is not raised again as a
   defect.

4. ~~A test account has full admin rights in production~~ — **deleted, on the owner's
   instruction.** "Teste Administrador" (no e-mail, role `administrator`, created on day
   one) was removed permanently on 3 Aug 2026, login and all. It had created nothing
   anywhere — zero rows across every table that references `profiles` — so no historical
   record was destroyed. The deletion is recorded in `system_audit_log` with the owner as
   actor and `claude-code:assistant` as the source. One administrator account remains.

## Also observed

- `last_login_at` is null for every account: nothing wrote it until this release, so the
  column starts filling from the next sign-in onwards.
- Nine of the sixteen models sit at 0% onboarding, and only one model has any onboarding
  rows at all.

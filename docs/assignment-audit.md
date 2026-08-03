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
| Kartel West | — | **9** | Carries every assigned model |
| Alex Harris | alexharris@karraymodels.com | 0 | Never assigned anything |
| ALEX HARRIS | — | 0 | Never assigned anything |

**7 of 16 models have no representative at all**, four of them active:

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

1. **Duplicate representative** — "Alex Harris" (created 20 Jul, has an e-mail) and
   "ALEX HARRIS" (created 22 Jul, no e-mail) are the same person. Both active, neither
   holds a model. One should almost certainly be archived.

2. **The rep carrying the roster may be you** — "Kartel West" is a *representative* account
   with no e-mail, while the owner account is "Kartel Oginga West"
   (kartelwest007@gmail.com). If those are the same person, the entire roster is assigned
   to a second account of the owner rather than to a working representative.

3. ~~A model also holds an administrator account~~ — **intended, confirmed by the owner.**
   "Raíssa de Sousa Vieira" (albetiza.teamo.123@gmail.com) is an administrator who is also
   model #9; the two are deliberately separate accounts, and the model area is reached
   through its own sign-in. Her admin account can read every model's data, which is what
   being an administrator means — noted here so the pairing is not raised again as a
   defect.

4. **A test account has full admin rights in production** — "Teste Administrador", no
   e-mail, role `administrator`, created on day one.

## Also observed

- `last_login_at` is null for every account: nothing wrote it until this release, so the
  column starts filling from the next sign-in onwards.
- Nine of the sixteen models sit at 0% onboarding, and only one model has any onboarding
  rows at all.

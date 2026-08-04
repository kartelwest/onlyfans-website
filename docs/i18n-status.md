# i18n handoff — KARAY Models (pt-BR / en-US)

**Read this before touching anything i18n-related.** It is written to be picked
up cold by someone with no history of the work: what exists, why it is built
the way it is, exactly what is left, and the traps that already cost time.

Companion doc: the README's *Internationalization* section is the day-to-day
usage guide (how to add a string, how to add a locale). This file is the
project state and the design rationale.

**Branch:** `claude/language-switcher-i18n-kw8hko` — **complete**, all eight
acceptance criteria met (§6).

---

## 1. TL;DR for whoever picks this up

**The work is done.** Every user-facing screen, every API route handler and
every shared `lib/` module that produces UI text now reads from the catalogs.

- Green as committed: `build` compiles, `lint` reports 0 errors, 279/279 tests
  pass, `i18n:check` passes at **2213 keys**, identical across both locales.
- Everything still hardcoded in Portuguese is deliberate and listed in **§8**:
  audit-log and note text (records, not UI), LLM prompt text, database enum
  values, storage-path components, and one wire-protocol constant.
- Go to **§5** for the recipe when you add a screen, **§7** for the traps, and
  **§8** for the judgment calls and why each went the way it did.

---

## 2. How the system works

Library: [`next-intl`](https://next-intl.dev) v4.13.5, in **"without i18n
routing"** mode. Next.js is **16.2.10** — check `node_modules/next/dist/docs/`
before assuming any Next API, several have changed.

### The rule that shapes everything

**The locale never appears in the URL.** There is no `/pt` or `/en` segment and
there must not be one — every route is the same address in both languages, and
the existing URLs are already public and linked from elsewhere. The locale lives
in a cookie and on the user's profile.

### Resolution order

Resolved **server-side, before render**, in `lib/i18n/resolveLocale.ts`:

1. `profiles.preferred_locale` — when signed in and set. This is what carries
   the choice to a second device.
2. The `NEXT_LOCALE` cookie (1 year, `path=/`, `sameSite=lax`, not httpOnly).
3. `pt-BR`.

`Accept-Language` is **deliberately not consulted**. A Brazilian agency defaults
to Portuguese even for a browser asking for English. Don't "fix" this.

Because it resolves on the server, the first paint is already correct — no flash
of the wrong language, and nothing for React to reconcile, which is why there
are zero hydration warnings.

### File map

| Path | What it is |
| --- | --- |
| `i18n/request.ts` | next-intl per-request config: locale, messages, timezone, named date/number formats |
| `lib/i18n/config.ts` | Locale vocabulary. **No Next/Supabase imports** — safe in client bundles, server, and the standalone check script |
| `lib/i18n/resolveLocale.ts` | The resolution order above |
| `lib/i18n/actions.ts` | `setLocale()` server action — writes cookie + profile |
| `lib/i18n/money.ts` | `useMoney()` — money formatters bound to the active locale |
| `components/LocaleSwitcher.tsx` | The one switcher, used by both headers |
| `public/flags/br.svg`, `us.svg` | Real SVG flags |
| `messages/pt-BR.json`, `en-US.json` | The catalogs |
| `scripts/i18n-check.mjs` | `npm run i18n:check` |
| `supabase/migrations/20260804010000_profile_preferred_locale.sql` | Column + RPC |
| `next.config.ts` | Wrapped with `createNextIntlPlugin("./i18n/request.ts")` |

---

## 3. Decisions already made — do not silently reverse these

Each of these was a deliberate call. If you disagree, raise it; don't just
change it.

### 3.1 Locale persistence goes through a `SECURITY DEFINER` RPC

Since `20260803000001_representative_system.sql`, the `profiles_update` RLS
policy is `using (public.is_staff())`. **A model or representative cannot write
to her own profile row at all.** That is deliberate and worth keeping — it is
what stops a rep editing her own lifecycle columns.

But every user needs to set their own language. Widening `profiles_update` to
`or id = auth.uid()` would hand back write access to every unguarded column on
the row — a far larger change than a language switcher should make. So there is
one function that writes one column for the caller and nobody else:

```sql
public.set_preferred_locale(p_locale text)  -- SECURITY DEFINER, pinned to auth.uid()
```

**Do not widen the RLS policy instead.**

### 3.2 `preferred_locale` is `TEXT` + `CHECK`, not a Postgres enum

Adding a third language should be one `ALTER` on a constraint, not an enum
migration with its locking and ordering problems. The brief also forbade
touching any existing enum, and none was touched.

### 3.3 Enum *labels* are translated; enum *values* never are

`enums.*` in the catalogs is keyed by the **raw database value**:

```json
"enums": { "modelStatus": { "candidate": "Candidata" } }
```

So ``t(`enums.modelStatus.${row.status}`)`` works directly off what the database
returned. No stored value changes, ever. Several components used to carry their
own local `{ active: "Ativa", … }` maps; those are gone, because two maps drift
and then one status reads two different ways on two screens.

### 3.4 The switcher sits *outside* the mobile hamburger

A language control you can only reach by first opening a menu written in a
language you cannot read is not reachable. It stays visible on the public
header at all widths (label hidden below `sm`, flag always shown).

### 3.5 Real SVG flags, not emoji

Emoji flags render as plain letters (`BR`, `US`) on Windows. The flags also
carry a border in CSS: the US flag's top and bottom stripes are white and would
otherwise bleed into any light surface.

### 3.6 Money formatting changed for existing pt-BR users

`formatMoney` used ICU's *narrow* currency symbol, so USD rendered as
`$1.200,00` to a Portuguese reader. The brief specified `US$ 1.234,56` — ICU's
standard symbol — so it now uses that. A bare `$` in Brazil is ambiguous with
the real, so this is also just clearer.

| | before | after |
| --- | --- | --- |
| USD, pt-BR | `$1.200,00` | `US$ 1.200,00` |
| COP, pt-BR | `$4.800.000,00` | `COP 4.800.000,00` |
| BRL, pt-BR | `R$ 6.504,00` | unchanged |

Tests updated. This is a **visible change for existing Portuguese users** — flag
it if you write release notes.

### 3.7 Two kinds of date, deliberately handled differently

- **Calendar dates** (birthday, `incurredOn`, `deductOn`) →
  `formatCalendarDate(iso, locale)` in `lib/earnings/period.ts`. It splits the
  ISO string's own parts and reorders them. It never constructs a `Date`,
  because `new Date("1998-04-22")` is UTC midnight and formatting that in São
  Paulo yields the **21st**.
- **Instants** (last login, audit timestamps) → `formatDateTime(date, locale)`
  in `lib/models/formatDateTime.ts`. Pinned to `America/Sao_Paulo` so a team
  spread over several countries sees one consistent history.

### 3.8 Error state is held as a *key*, not a sentence

`LoginForm` and `ChangePasswordPage` hold the failure **reason** in state and
translate at render. Holding the translated sentence would freeze it in
whichever language was active when the failure happened, so switching language
afterwards would leave a stale message on screen. Copy this pattern.

---

## 4. Catalog conventions

Namespaces (both files must have identical key sets):

| Namespace | Contents |
| --- | --- |
| `common` | `actions` (save/cancel/delete…), `states` (loading/empty/yes/no…), `metadata`, `localeSwitcher`, `datePicker` |
| `nav` | Public header/nav |
| `site` | Public marketing pages: `hero`, `whyUs`, `difference`, `footer`, `faq`, `whyUsPage`, `terms`, `privacy`, `apply`, `googlePhotos`, `recordingGuidelines` |
| `auth` | Login, logout, change password |
| `dashboard` | The model's own area |
| `enums` | Display labels keyed by database value |
| `errors` | `login.*`, `notFound`, `serverError`, plus generic `saveFailed`/`loadFailed`/`generic` |
| `admin` | Back office, sub-namespaced per screen |
| `owner` | Owner-only account screens |
| `models`, `earnings`, `expenses`, `loans`, `settings`, `validation` | Feature namespaces from the original brief |

**Reuse before inventing.** `common.actions.save`, `common.states.loading`,
`errors.saveFailed` and `enums.*` already cover most of what a new screen needs.

**Structured content is allowed.** Long-form pages (FAQ, Why Us, the Google
Photos guide) store arrays/objects and read them with `t.raw(key)`. The checker
walks arrays by index, so a paragraph present in one locale and missing in the
other fails as a missing key.

**Never translate:** user- or DB-authored content (model names, note bodies,
uploaded filenames, hotel names, admin-typed descriptions), and database enum
values themselves.

---

## 5. How to translate a new screen

### 5.1 Finding what is left

Nothing is outstanding, but new code arrives untranslated. Two scanners were
written for this sweep and both are worth re-running after any feature lands.

The accent grep is the quick one — and it is the one that **lies** (§7.1):

```bash
grep -rlE '"[^"]*[áàâãéêíóôõúçÁÉÍÓÚÇ][^"]*"' --include=*.tsx --include=*.ts app components lib
```

It misses two whole classes that this sweep had to chase down separately:

1. **Unaccented Portuguese** — `Salvar`, `Nome`, `Enviar`, `Erro interno.`,
   `Ocorreu um erro inesperado.` Match on common Portuguese words instead of
   accents.
2. **Bare JSX text nodes** — `<p>Perfil da modelo</p>` has no quotes at all, so
   no string-literal grep will ever see it. Roughly a third of what this sweep
   fixed was of this shape. Extract text nodes with a `>([^<>{}]+)<` scan over
   the file, skipping anything that is only punctuation, digits or a brand name.

**Known false positives — already handled, do not re-open:**

**Known false positives — already handled, do not re-open:**

- `app/aplicar/page.tsx` — Portuguese country **values** (`"Colômbia"`, …). These
  are what `/api/aplicar` persists; changing them orphans every stored row. Only
  their labels are translated.
- `ChatAssistant.tsx`, `ModelDashboardView.tsx` — the `✓` and `•` glyphs.
- `DeleteRepresentativeButton.tsx`, `RepresentativesClient.tsx` — the word
  `excluído` inside a code comment describing a bug that was fixed.

### 5.2 The recipe (client / non-async server component)

```bash
grep -nE '"[A-Za-zÀ-ÿ][^"]{2,}"|>\s*[A-ZÀ-ÿ][^<>{}]{2,}<|label=|placeholder=|title=|aria-label=' <file>
```

```tsx
import { useTranslations } from "next-intl";

const t = useTranslations("admin.someScreen");
const tCommon = useTranslations("common.actions");

<button>{saving ? tCommon("saving") : tCommon("save")}</button>
```

`useTranslations` works in **both** Server and Client Components — but not in an
`async` one.

### 5.3 The recipe (async server component, server action, route handler)

```tsx
import { getTranslations } from "next-intl/server";

const t = await getTranslations("admin.someScreen");
```

### 5.4 The API routes

They return `{ error: "…" }` in Portuguese and those strings surface in the UI.
`getTranslations()` works inside a route handler — it has the request cookies,
so it resolves the caller's locale exactly as a page does. **No client refactor
is needed.**

`app/admin/models/[slug]/actions.ts` is already converted this way — copy it.

> The alternative — returning error *codes* and translating client-side — is
> architecturally nicer but changes every consumer. Get a decision from the
> repo owner before starting that.

### 5.5 Money and dates while you sweep

If a file prints money or a date, fix it at the same time:

```tsx
import { useMoney } from "@/lib/i18n/money";
const money = useMoney();
money.format(amount, BRL);            // not `R$ ${x.toFixed(2)}`
money.fxRate(rate, USD, "BRL");
```

Grep for `toFixed(`, `toLocaleString`, `toLocaleDateString`, `"pt-BR"` — each is
a likely hardcode.

### 5.6 Verify, then commit

```bash
npm run i18n:check && npx tsc --noEmit && npm run lint && npm test && npm run build
```

Commit per file or small batch. Don't let a large uncommitted sweep accumulate.

---

## 6. Definition of done

Acceptance criterion 6 of the brief — *"grep the codebase: no remaining
hardcoded user-facing strings in JSX"* — is the only one not yet met. Everything
else is done and verified:

1. ✅ Fresh visitor with no cookie sees the entire site in pt-BR
2. ✅ Switcher visible on public site **and** back office, desktop **and** mobile
3. ✅ Switching on a deep page keeps you on that exact page
4. ✅ Hard refresh preserves it; profile column carries it across devices
5. ✅ Zero hydration warnings
6. ✅ **No hardcoded user-facing strings** — everything that remains in
   Portuguese is deliberate and enumerated in §8
7. ✅ `npm run i18n:check` passes
8. ✅ No URL, route or database enum value changed

Verified behaviour, in a real
browser against a production build across `/`, `/faq`, `/por-que-nos`,
`/termos`, `/privacidade`, `/diretrizes-de-gravacao`, `/login` and a bad URL, in
both locales: correct `<html lang>`, correct 404 status, no raw translation keys
in the DOM, and a console carrying only the pre-existing
`Supabase environment variables are missing` warning (this sandbox has no
credentials).

### Coverage

The entire public marketing site (home, Why Us, FAQ, terms, privacy, recording
guidelines, the Google Photos guide and the public **application form**), both
site headers and the footer, login, change-password, the 404/500 pages, the
**model dashboard**, and a large part of the back office — the models list, the
model detail page and its checklist, the history tab, payments, the ledger,
monthly earnings, social accounts, financial settings, the representatives list,
pageview, the Amplia overview and new-client form, and the owner account pages.

Completed in the final sweep: the notes tab and its history, the documents,
platforms, earnings and overview tabs, the onboarding checklist panel (including
every step title, description, field label and placeholder from
`lib/onboarding/definition.ts`), the new-user form and page, the assistant and
importer screens, the representative detail page and dashboards, the view-as
banner, the Amplia client list, the owner portal, the shared confirmation
dialog, the idle-timeout warning, and all 37 API route handlers plus the shared
`lib/` modules they call.

Two structural choices worth knowing about:

- **`lib/onboarding/definition.ts` keeps its Portuguese text.** The file stays
  the structural source of truth — permanent `key` values, field types, linked
  columns — and the words now live in the `onboarding.*` catalog keyed by those
  same keys. `lib/onboarding/server.ts` resolves them when it builds the view.
  The Portuguese in the definition file is what the audit log records.
- **Validation and upload failures travel as keys, not sentences.**
  `lib/ledger/validation.ts` returns `errorKey`, `lib/models/avatarUpload.ts`
  returns `messageKey`. Both run on the server *and* in the browser, so neither
  can know the reader's locale — whoever renders resolves it.

---

## 7. Traps — these already cost time

### 7.1 The progress grep lies

It matches **accented** strings only. It misses `Salvar`, `Nome`, `Total`,
`Enviar`, `Status`, `Email`. **A file reporting zero hits is not necessarily
clean.** Two files that had "passed" still had a `" (Proprietário)"` role suffix
hiding inside a ternary. Read every file you touch.

### 7.2 ICU uses a non-breaking space in money

`US$ 1.200,00` contains **U+00A0**, not a regular space. Any test or comparison
against a formatted-money literal must use it. See
`tests/currency-format.test.ts`, which spells it out as a named constant.

### 7.3 Hooks below an early return

Several components `return null` before their render body. Dropping
`useTranslations` in at the point of use puts it after that return and breaks
the rules of hooks — `npm run lint` catches it as an error. Put translator hooks
at the very top of the component.

### 7.4 Colouring a banner by sniffing the message text

Three files did `message.includes("sucesso")` / `.includes("excluído")` to
choose green vs red. **That turns every success red the moment the server
answers in English.** All three now key off the action's own `success` flag.
Grep `includes("` before you finish.

### 7.5 Nested components need their own translator

A file often defines several small components (`InfoCard`, `StatusBadge`,
`SocialInfo`). Each needs its own `useTranslations` call — the parent's `t` is
not in scope, and TypeScript will tell you.

### 7.6 ICU plural syntax vs the placeholder checker

`{count, plural, one {# item} other {# items}}` is fine. The checker was taught
that an argument name is always followed by `}` or `,`, so plural branches are
not mistaken for placeholders. If you hand-edit `scripts/i18n-check.mjs`, keep
that lookahead.

### 7.7 Next.js 16 is not the Next.js you know

`AGENTS.md` says this and it is true. Confirmed differences already hit:
`middleware` is now `proxy.ts`; `error.tsx` receives `unstable_retry` (not
`reset`); `cookies()` is async. **Read `node_modules/next/dist/docs/` before
assuming an API.**

---

## 8. Strings that were judgment calls

The brief asked for this list: cases where a string was plausibly either UI copy
or stored/user content.

### Left in Portuguese deliberately — these are records, not UI

| Where | String | Why |
| --- | --- | --- |
| `lib/models/representativeAssignment.ts` | assignment audit note text | Written **into** `model_notes` / audit history and read back as a historical record. Translating at write time leaves a database of mixed-language notes that no longer match what the actor saw. |
| `lib/models/applicantIntake.ts` | intake note text | Same — persisted, not rendered from a catalog. |
| `app/api/admin/models/credentials/route.ts` | credential note text | Same. |
| `app/api/admin/import/confirm/route.ts` | `"Candidata importada de PDF/imagem"` | Written to the audit summary column. |
| `supabase/migrations/*` | trigger `raise exception` messages | Database-level, e.g. `'Apenas o proprietário pode alterar o papel.'`. These reach a user only through a generic failure path. Translating them means moving them into the app layer — a real change to error handling, not an i18n change. **Flagged, not done.** |
| `DeleteRepresentativeButton` → `deleteRepresentative` | the **wire value** `"EXCLUIR"` sent in the form data | Compared verbatim by the server action, so it is a protocol constant. The phrase the *user types* is separate and localised (`admin.representatives.delete.confirmPhrase` → `EXCLUIR` / `DELETE`); the dialog gates locally on that, then the client sends the constant. Same split in `owner/users/[id]/DeleteAccountButton`. |
| `lib/audit/auditLogger.ts` | `getFieldLabel` field-name map | Used **only** to compose audit summaries, which are stored. The same field names are separately translated for display under `onboarding.linkedFields.*`. |
| `lib/anthropic/*.ts` | tool schemas and system prompts | Instructions **to Claude**, not to a reader. They are written in Portuguese on purpose: they describe Portuguese-language intake documents and the field vocabulary of the Brazilian form. |
| `app/api/models/documents/route.ts` | `sanitizeFileName`'s `"arquivo"` fallback | Becomes part of the storage path. A locale-dependent path would scatter the same model's files across two prefixes. |
| `app/api/models/onboarding/route.ts` | `STATUS_WORDS`, the `"sim"`/`"não"` readable values | Written into audit summaries as before/after values. |
| `lib/brand/boundaries.ts` | the nudity-flag note | Ends up in `riskNotes` on the generated content item — a stored moderation annotation. |
| `lib/onboarding/definition.ts` | every `title`, `description`, `label` | The file remains the canonical structure; the *displayed* words come from the `onboarding.*` catalog keyed by the same permanent keys, resolved in `lib/onboarding/server.ts`. The Portuguese here is what audit summaries record. |

If you want these to follow the reader, the fix is to store a machine-readable
code plus params and render the sentence at read time. That is a schema change,
so it was not done unasked.

### Translated, though arguably borderline

| Where | Reasoning |
| --- | --- |
| `enums.ledgerProvider.*` (`Uber`, `99`, `inDrive`) | Identical in both files — brand names. In the catalog so a future locale can transliterate. |
| `nav.amplia` → `AMPLIA` | Product name, same in both. In the catalog so it isn't a special case in code. |
| `site.footer.whatsappNumber` | The number is passed in as `{number}` and lives in code; only the `(WhatsApp)` suffix is translatable. |
| `site.hero.imageAlt` | Alt text is UI copy — it is read aloud to the reader. |
| Hotel names in ledger rows | **Not** translated. Admin-entered; it is a place. The `Hotel ·` prefix around it is. |
| Country names in `app/aplicar` | Labels translated, **values** left as-is — they are persisted. |
| Model names, note bodies, uploaded filenames | Not translated, per the brief — **a note stays in whatever language it was written in**, on the way in and on the way out. Only the surrounding chrome (buttons, errors, the "unknown user" fallback) follows the reader. |
| `admin.notes.actions.*` (note-history labels) | The action itself is a stored database value; only the sentence shown beside it in the timeline is translated. `app/api/models/history/route.ts` maps the value to a catalog key. |
| `errors.instagram.*` | `accountStatusWarningKey` returns a key rather than a sentence, so the same helper serves a server route and a client panel. |

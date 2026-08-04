# Internationalization — status and judgment calls

Companion to the README's i18n section. The README says how the system works;
this file says **how far the sweep got** and **which strings I had to make a
call on**.

---

## 1. Complete and verified

The mechanism is finished. Everything below was built, built cleanly, and
checked in a browser:

| Area | State |
| --- | --- |
| next-intl, cookie-based, no URL segment | done — no route changed |
| Locale resolution (profile → cookie → pt-BR) | done, server-side |
| `preferred_locale` migration + `set_preferred_locale()` RPC | done |
| `<LocaleSwitcher />` in both headers, desktop + mobile | done |
| SVG flags at `/public/flags/{br,us}.svg` | done, no emoji |
| `<html lang>`, `generateMetadata` | done |
| Locale-aware money, dates, month names | done |
| `enums.*` display labels (no DB enum touched) | done |
| 404 / 500 pages | done |
| `npm run i18n:check` | done, 628 keys, passing |
| README documentation | done |

Behaviour verified in a real browser against a production build:

- Fresh visitor, no cookie → entire site pt-BR, `<html lang="pt-BR">`.
- Switching to EN on `/faq` stays on `/faq`, re-renders in English,
  `<html lang="en-US">`, `NEXT_LOCALE=en-US`.
- Hard refresh preserves the choice.
- 404 returns HTTP 404 in both languages.
- **Zero hydration warnings.** Sweeping `/`, `/faq`, `/por-que-nos`, `/termos`,
  `/privacidade`, `/diretrizes-de-gravacao`, `/login` and a bad URL in both
  locales, the console carries exactly two lines, neither from i18n: the
  pre-existing `Supabase environment variables are missing` warning (this
  sandbox has no credentials), and the 404 response on the deliberately-bad
  URL, which is the thing being tested.
- No raw translation key leaks into the DOM on any of those pages — checked by
  grepping the rendered body for `namespace.key` patterns.

Screens fully translated: the whole public marketing site (home, Why Us, FAQ,
terms, privacy, recording guidelines), both site headers and the footer, login,
change-password, the error pages, and the **model dashboard** — the screen the
largest number of people actually use.

## 2. Not yet swept

**81 files still contain hardcoded Portuguese**: 44 UI files and 37 API routes.
Acceptance criterion 6 ("grep the codebase: no remaining hardcoded user-facing
strings") is therefore **not met yet**, which is why this has not been merged to
`main`.

Nothing is broken by this. An untranslated screen renders its original
Portuguese exactly as it did before; there are no missing-key placeholders,
because those strings were never turned into keys.

Concentrations, largest first:

- `components/admin/model/**` — 17 files. The model detail tabs: notes,
  earnings, payments, documents, checklist, platforms, ledger.
- `components/admin/**` — 6 files, incl. the importer panel and photo upload.
- `app/admin/**` — the models list, the model detail client, representatives,
  the new-user form.
- `app/aplicar/page.tsx` — the public application form. Worth doing early;
  it is the only untranslated page a signed-out visitor can reach.
- `app/api/**` — 37 route handlers.

### A note on the API routes

They return `{ error: "..." }` in Portuguese, and those strings surface in the
UI. The pattern that works here is `getTranslations()` inside the handler — a
route handler has the request cookies, so it resolves the caller's locale the
same way a page does. No client refactor is needed.

The alternative — returning error *codes* and translating client-side — is
architecturally nicer but changes every consumer, so I would not start it
without a decision from you.

### Watch out when finishing the sweep

My progress grep was `"[^"]*[áàâãéêíóôõúç][^"]*"`, which finds accented strings.
**It misses unaccented Portuguese** — `Salvar`, `Nome`, `Total`, `Enviar` — and
it produces false positives on symbols like `✓`. A file that reports zero hits
is not necessarily clean. Read each file; don't trust the count.

## 3. Strings I had to make a call on

This is the review list the brief asked for. In each case the string was
plausibly either UI copy or stored/user content.

### Left in Portuguese deliberately — these are records, not UI

| Where | String | Why |
| --- | --- | --- |
| `lib/models/representativeAssignment.ts` | assignment audit note text | Written **into** `model_notes` / audit history and read back later as a historical record. Translating at write time would leave a database full of mixed-language notes, and the note would no longer match what the actor saw. |
| `lib/models/applicantIntake.ts` | intake note text | Same — persisted, not rendered from a catalog. |
| `app/api/admin/models/credentials/route.ts` | credential note text | Same. |
| `app/api/admin/import/confirm/route.ts` | `"Candidata importada de PDF/imagem"` | Written to the audit summary column. |
| `supabase/migrations/*` | trigger `raise exception` messages | Database-level, e.g. `'Apenas o proprietário pode alterar o papel.'`. These reach a user only via a generic failure path. Translating them means moving them into the app layer — a real change to error handling, not an i18n change. **Flagging rather than doing.** |

If you would rather these followed the reader, the fix is to store a
machine-readable code plus params and render the sentence at read time. That is
a schema change, so I did not make it unasked.

### Translated, though arguably borderline

| Where | String | Reasoning |
| --- | --- | --- |
| `enums.ledgerProvider.*` | `Uber`, `99`, `inDrive` | Kept in the catalog for completeness, but identical in both files — they are brand names. Present so a future locale can transliterate if it must. |
| `nav.amplia` → `AMPLIA` | product name | Same in both. In the catalog so it is not a special case in code. |
| `site.footer.whatsappNumber` | `+1 (312) 470-2299` | The number is passed **in** as `{number}` and lives in code. Only the `(WhatsApp)` suffix is translatable. |
| `site.hero.imageAlt` | "Model on a yacht in Rio de Janeiro" | Alt text is UI copy — it is read aloud to the reader. |
| Hotel names in ledger rows | e.g. `Ibis Centro` | **Not** translated. Admin-entered; it is a place. The `Hotel ·` prefix around it is. |
| Model names, notes, uploaded filenames | — | Not translated, per the brief. |

### One behavioural change worth your eye

`formatMoney` previously used ICU's *narrow* currency symbol, so USD rendered as
`$1.200,00` for a Portuguese reader. The brief specifies `US$ 1.234,56`, which
is ICU's standard symbol, so I switched to it. This changes existing pt-BR
output:

| | before | after |
| --- | --- | --- |
| USD, pt-BR | `$1.200,00` | `US$ 1.200,00` |
| COP, pt-BR | `$4.800.000,00` | `COP 4.800.000,00` |
| BRL, pt-BR | `R$ 6.504,00` | unchanged |

I think this is an improvement — a bare `$` in Brazil is ambiguous with the real
— and it is what the brief asked for. But it is a visible change for existing
Portuguese users, so it should not surprise you. Tests updated accordingly.

Related trap: ICU separates symbol from digits with a **non-breaking space**
(U+00A0), not a normal one. Any test or comparison against a money literal has
to use ` `.

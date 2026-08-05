This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Internationalization (pt-BR / en-US)

The product ships in Brazilian Portuguese and US English, using
[next-intl](https://next-intl.dev) in **"without i18n routing"** mode. There is
no `/pt` or `/en` URL segment and there must not be one — every route is the
same address in both languages.

### How the locale is chosen

Resolved server-side, before anything renders, in this order
(`lib/i18n/resolveLocale.ts`):

1. `profiles.preferred_locale`, when the viewer is signed in and has one. This
   is what carries the choice to a second device.
2. The `NEXT_LOCALE` cookie (1 year, `path=/`, `sameSite=lax`).
3. `pt-BR`.

`Accept-Language` is deliberately **not** consulted. A Brazilian agency defaults
to Portuguese even for a browser that asks for English.

Because it is resolved on the server, the first paint is already in the right
language — there is no flash of the wrong one and nothing for React to correct,
so no hydration warning.

### Adding a new string

1. Put it in **both** `messages/pt-BR.json` and `messages/en-US.json`, under the
   namespace that matches the feature (`common`, `nav`, `auth`, `dashboard`,
   `models`, `earnings`, `expenses`, `loans`, `settings`, `errors`,
   `validation`, `admin`, `enums`, `site`). The two files must always have the
   same key set.
2. Read it in a component:

   ```tsx
   import { useTranslations } from "next-intl";

   const t = useTranslations("admin.nav");
   return <span>{t("models")}</span>;
   ```

   `useTranslations` works in Server **and** Client Components. In an `async`
   Server Component, or in `generateMetadata`, use the awaitable form instead:

   ```tsx
   import { getTranslations } from "next-intl/server";

   const t = await getTranslations("common.metadata");
   ```

3. Run `npm run i18n:check`.

Interpolation uses ICU: `"greeting": "Olá, {name}"` → `t("greeting", { name })`.
The checker enforces that both locales use the same placeholders, so a
translation cannot silently drop a `{count}`.

**What does NOT belong in the catalogs:** user- or DB-authored content — model
names, notes, uploaded file names, admin-entered descriptions — and the database
enum *values* themselves. Enum **labels** are translated, under `enums.*`, keyed
by the raw database value (`enums.modelStatus.candidate`), so the stored value
never changes.

### Formatting numbers, money and dates

Never call `toLocaleString` directly. Use the locale-aware helpers, which follow
the switcher:

```tsx
import { useFormatter } from "next-intl";
import { useMoney } from "@/lib/i18n/money";

const format = useFormatter();
const money = useMoney();

format.dateTime(date, "short");        // 09/03/2026  ·  03/09/2026
format.number(value, "decimal");       // 1.234,56    ·  1,234.56
money.format(1200, "USD");             // US$ 1.200,00 ·  $1,200.00
```

Amounts keep the currency they are stored in — only the presentation follows the
reader. Named date/number formats live in `i18n/request.ts`.

Note that ICU separates a currency symbol from its digits with a **non-breaking
space** (U+00A0). Anything comparing formatted money against a literal has to
account for that.

### Adding a new locale

1. Add the tag to `LOCALES` in `lib/i18n/config.ts`, plus its entry in
   `LOCALE_LABELS` and `LOCALE_FLAGS`.
2. Add `public/flags/<cc>.svg`. Use a real SVG — emoji flags render as plain
   letters on Windows.
3. Copy `messages/pt-BR.json` to `messages/<tag>.json` and translate it.
4. Widen the database constraint, which is a one-line `ALTER` because
   `preferred_locale` is `TEXT` with a `CHECK` rather than a Postgres enum:

   ```sql
   alter table public.profiles drop constraint profiles_preferred_locale_check;
   alter table public.profiles add constraint profiles_preferred_locale_check
     check (preferred_locale in ('pt-BR', 'en-US', '<tag>'));
   ```

   Update the same list inside `public.set_preferred_locale()`.
5. Run `npm run i18n:check`.

The switcher, `<html lang>` and `generateMetadata` all read from `LOCALES` and
need no further change.

### Checking the catalogs

```bash
npm run i18n:check
```

Fails on: a key present in one catalog and missing from another, an empty value,
a key that is an object in one locale and a string in the other, and ICU
placeholder drift between locales. Safe to run in CI.

## Database backups

The Supabase project is on the **free plan: no automated backups and no
point-in-time recovery**. `/api/cron/database-backup` runs nightly at 04:30 UTC
(`vercel.json`) and is the only thing standing between a bad night and starting
over. Buying Supabase Pro would give managed daily backups and PITR covering
auth and storage as well, and is the better primary — this job is the off-site
copy that survives losing the Supabase account itself.

**What it does.** `public.export_database_backup()` walks `pg_class`, so every
table in `public` is included the day it is created — a backup that named its
tables would go stale the first time somebody added one, and would keep
reporting success while skipping the new data. The payload is gzipped, then
encrypted with AES-256-GCM, then written to **both** the private
`database-backups` bucket (fast restores) and a Google Drive folder (survives
Supabase). Old files are pruned after 30 days; anything the job does not
recognise by name is left alone.

**Required environment.**

| Variable | Effect if missing |
|---|---|
| `CRON_SECRET` | Route answers 503. Already set for the other crons. |
| `BACKUP_ENCRYPTION_KEY` | **The job refuses to run.** It will not write personal data unencrypted. |
| `GOOGLE_DRIVE_BACKUP_FOLDER_ID` | Storage still gets its copy; Drive is reported as skipped. |

Generate the key with
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and
store it **somewhere other than the Drive folder** — a key kept beside the
backups protects nothing. Lose it and the backups are unreadable. Share the
Drive folder with `GOOGLE_SERVICE_ACCOUNT_EMAIL` as an Editor; service accounts
see nothing that has not been shared with them.

**Checking on it.** Every run writes to `system_audit_log` — success or failure,
under actor `Backup automático`. A backup job whose failures are invisible is
worse than none, because it produces confidence without producing backups.

```sql
select created_at, action, summary from system_audit_log
 where action like 'database_backup%' order by created_at desc limit 14;
```

A run that reached one destination but not the other answers `207` and says
which one failed.

**Restoring.**

```bash
node -e '
  const {decryptBackup,resolveBackupKey}=require("./lib/backup/crypto");
  const {gunzipSync}=require("zlib"), fs=require("fs");
  fs.writeFileSync("backup.json", gunzipSync(decryptBackup(
    fs.readFileSync(process.argv[1]), resolveBackupKey(process.env.BACKUP_ENCRYPTION_KEY))));
' karay-backup-....json.gz.enc
```

That yields `{ tables, auth_users, schema }`. Rebuild structure from
`supabase/migrations/`, load the tables, then recreate accounts from
`auth_users` and issue password resets — hashes are deliberately not exported.
Compare the restored schema against the `schema` key before trusting it:
production has drifted from the migrations before (see `20260803020000` and
`20260805070000`), which is why the live schema is captured alongside the data.

**Not covered:** storage buckets (`model-documents`, `model-earnings`). Both are
empty today, so nothing is missing yet — that stops being true the moment
somebody uploads a document.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

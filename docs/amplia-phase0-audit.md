# Phase 0 — Amplia Brand Growth Impact Report

> Audit performed on commit `aef44d6` (origin/main). No code changes.

## 1. Existing stack

- Next.js 16.2.10 (App Router), React 19.2.4, TypeScript 5, Tailwind 4.
- Supabase: Auth, PostgreSQL, Storage. Server client via `@supabase/ssr`.
- Anthropic SDK already integrated (`lib/anthropic/*`, `CLAUDE_MODEL=claude-sonnet-5`).
- Vercel hosting inferred from README.

## 2. Database schema (from migrations + drift note)

- `public.profiles` (1:1 with `auth.users`) holds `role`, `full_name`, `active`, `must_change_password`.
- `public.models` is the existing talent/person table: personal data, social links, drive links, status, onboarding.
- Child tables: `model_checklist`, `model_platforms`, `model_drive_folders`, `model_documents`, `model_payments`, `model_earnings_reports`, `model_onboarding_items`, `model_notes`, `model_note_history`.
- `app_settings` key/value JSONB store exists.
- **Important drift:** migration `20260724000001_rep_dashboard.sql` explicitly states the live schema has drifted from earlier migration files. Live helper functions are `public.is_management()`, `public.is_owner()`, `public.is_assigned_representative(uuid)`, `private.is_own_model(uuid)`, and `model_checklist` statuses are plain `text`, not the `checklist_status` enum. The initial migrations are still useful as a base, but new migrations must be `IF NOT EXISTS`/`CREATE OR REPLACE` and avoid assuming enum usage.
- Column-level SELECT on `public.models` is now explicitly granted per-column (excluding `instagram_marketing`/`twitter_marketing`). Any new column added to `public.models` will not be selectable by `authenticated` until added to that grant.
- Storage buckets: `model-documents` (private), `model-earnings` (private), `model-avatars` (public).

## 3. Auth & session handling

- `lib/supabase/server.ts`: `createServerClient` from `@supabase/ssr`, uses `cookies()` from `next/headers`.
- `lib/supabase/client.ts`: browser client, also validates env vars at call time.
- `lib/supabase/admin.ts`: service-role client for privileged ops.
- `proxy.ts` middleware: coarse gating for protected routes, calls `supabase.auth.getUser()`.
- `login/page.tsx` routes by role: owner→/owner, admin→/admin/models, rep→/representative, model→/area-da-modelo.
- `app/admin/models/[slug]/page.tsx` and `app/admin/models/page.tsx` use `export const dynamic = "force-dynamic"`.

## 4. Role logic

Current roles: `owner`, `administrator`, `representative`, `model`.
Helper predicates:
- `public.is_active_user()`, `public.is_owner()`, `public.is_staff()` (owner+administrator).
- `public.is_assigned_rep(target_model uuid)`, `public.owns_model(target_model uuid)`, `public.can_read_model(target_model uuid)`.
New Brand Growth operational roles (`Brand Manager`, `Content Manager`, `Analyst`, `Reviewer`) need to be added to the enum and predicates.

## 5. Storage buckets & access

- `model-documents`, `model-earnings`: private, staff-only via RLS.
- `model-avatars`: public bucket, write restricted to model's own folder or management.
- Amplia will need a private `brand-assets` bucket (photos, videos, BTS, reels, logos, voice, release docs) with RLS per talent and signed URLs.

## 6. Reusable UI / design tokens

- Global colors in `app/globals.css`: `--background #f7f1ec`, `--surface #fffaf6`, `--plum #4b2438`, `--plum-dark #321725`, `--rose #b67b8d`, `--charcoal #272126`, `--muted #74696f`.
- Public pages use light theme (`#f7f1ec` background).
- Admin portal uses dark theme (`bg-[#08080a]`, `bg-[#111115]`, `bg-[#2a1521]`, pink accents `text-pink-300`, emerald/yellow/red status badges).
- Common patterns in `app/admin/models/page.tsx`: `MetricCard`, `TableHeading`/`TableCell`, `StatusBadge`, `OnboardingProgress`, details panels with `border-white/10 bg-[#111115]`.
- `components/ui/` is almost empty (only `BirthdayDatePicker.tsx`).
- `app/admin/models/[slug]/ModelAdminClient.tsx` provides a tabbed dark layout we can mirror for Amplia client pages.
- `components/ConditionalPublicLayout.tsx` lists private routes. `/admin`, `/administrator`, `/representative`, `/area-da-modelo`, `/login` are currently hidden from public nav. Amplia routes must be added here and protected at route/middleware/RLS levels.

## 7. Routing / navigation

Public routes: `/`, `/por-que-nos`, `/faq`, `/aplicar`, `/como-compartilhar-google-photos`.
Private admin: `/admin/models`, `/admin/models/[slug]`, `/admin/import`, `/admin/assistant`, `/admin/users/new`, `/admin/view-as/*`.
Owner: `/owner`, `/owner/users`, `/owner/users/new`, `/owner/users/[id]`.
Representative: `/representative`, `/representative/models/[id]`.
Model: `/area-da-modelo`, `/alterar-senha`.

Amplia needs new top-level route `/amplia` (and sub-routes) linked from the top navigation, gated to `owner`/`administrator`.

## 8. Where the new module attaches

1. **Talent identity:** `public.models` can be renamed conceptually to `talents` through the new `talents` table or by treating `models` as the existing talent table. The prompt requires one shared identity table (`talents`) with `service_enrollments`. Because existing code and RLS extensively reference `public.models`, the safest path is:
   - Create new `talents` table that mirrors/recruits from `models` for Brand-Growth-only clients, OR
   - Add `talent_id` to `models` and create `talents` as a thin wrapper. Recommended: create `talents` as the canonical identity and keep `models` as a legacy/specific enrollment for OnlyFans, with a migration-time backfill mapping existing `models` rows to `talents`.
   - For minimal risk in this build, we will create `talents` with a 1:1 optional link to `models` and copy/derive data from `models` at enrollment time.

2. **Service enrollments:** new `service_types` + `service_enrollments` tables. Service `onlyfans` and `brand_growth` (internal code name), with `instagram`/`x` toggles inside the brand profile.

3. **Auth/roles:** extend `management_role` enum; add `is_brand_manager()` etc. helper predicates. Keep existing `is_staff()` semantics unchanged.

4. **Navigation:** add `Amplia` link in `components/Navbar.tsx` (public) and admin header; update `ConditionalPublicLayout.tsx` to treat `/amplia` as private.

5. **Model profile:** add a `Brand Growth` tab to the existing model admin client, reusing data from `brand_profiles` and linking to the Amplia portal.

## 9. Technical debt & blockers

- **Build-time env dependency:** `lib/supabase/server.ts` and `lib/supabase/client.ts` throw if `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing. This causes `next build` to fail during prerendering of `/alterar-senha` (and likely `/login`) unless env vars are present. Deployment requires these secrets, or the affected client pages need `export const dynamic = "force-dynamic"`.
- **Schema drift:** initial migration files are not fully authoritative. New migrations must be idempotent and `CREATE OR REPLACE`/fallback-safe.
- **Node version:** Supabase packages warn that Node 20 is deprecated; Node 22+ will eventually be required.
- **Security hardening:** `public.models` column allowlist must be respected when adding new columns. Marketing social columns are already isolated. Token fields for Instagram must be encrypted server-side and never exposed to the browser or AI providers.
- **External dependencies:** Instagram Graph API publishing requires Meta Business Verification + App Review (weeks). X API is pay-per-use and must remain feature-flagged OFF. These cannot be completed without external credentials/review.

## 10. Recommended approach

- Phase 1: Add `talents`, `service_types`, `service_enrollments`, `brand_profiles` (with `niche_1/2/3`, `ai_guidance`), `client_consents`, `brand_boundaries`, and `app_settings` entry for feature flags. Build Amplia shell (`/amplia/*`) with RLS and owner/admin-only access.
- Phase 2: Account Launch Center + status enum + launch packet generation (Anthropic).
- Phase 3: Content Studio: pillars, content items, calendar, approvals.
- Phase 4: Instagram OAuth + container/publish stubs; fail-closed until Meta App Review and tokens are configured.
- Phase 5: X Layer 1 OFF (flag `FEATURE_X_ENABLED=false`), Layer 2 Manual Playbook active.
- Phase 6-8: Research, autopilot rules, client portal, reports, alerts.

## 11. Assumptions (proceeding under user direction)

- Meta Developer App / Business Verification / App Review: **not available yet** → Instagram live API is stubbed/fail-closed.
- X API: **inactive** (`FEATURE_X_ENABLED=false`).
- AI provider: Anthropic (existing `CLAUDE_MODEL`).
- Default languages: PT-BR, EN, ES.
- Adult-platform links (OnlyFans): consent-gated + human review required; default off.
- Approval authority: owner/administrator by default; brand manager role added later.
- Community management: human-in-the-loop; AI only suggests replies.

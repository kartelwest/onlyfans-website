# KARAY ↔ RAYSSA integration contract — v1

**This file exists in two repositories and the copies must be identical.**
`onlyfans-website/docs/rayssa/API-CONTRACT.md` and `rayssa/docs/API-CONTRACT.md`. When it
changes, both change in the same sitting. A drifted contract is a production bug that
reproduces on neither side alone.

KARAY is the server. RAYSSA is the only client. The two run on separate databases with no
shared connection; this API is the entire seam between them.

---

## Principles

1. **Read-only, with one exception.** Two `GET`s and a single narrow `POST` that ticks a
   daily-checklist item. Nothing else in KARAY is writable from RAYSSA, ever.
2. **Explicit columns, never `select *`.** Every field in a response is named in this
   document and named in the query. A new column added to KARAY later cannot start flowing
   out on its own — this is the property that makes the boundary hold over time, and it is
   worth more than the convenience of a wildcard.
3. **Never exposed, in any endpoint:** earnings, payments, payout details, identity
   documents, dates of birth, legal names, addresses, phone numbers, email addresses, proxy
   credentials, internal notes, representative personal records. If a future endpoint seems
   to need one of these, the answer is no — reopen the design instead.
4. **Versioned by path.** `/v1/` is frozen once RAYSSA is live. Changes ship as `/v2/`, with
   `/v1/` serving until RAYSSA has migrated off it.
5. **Additive changes only within a version.** Adding an optional field to a response is
   permitted. Renaming, removing, retyping, or changing the meaning of a field is not.

## Authentication

Every request:

```
Authorization: Bearer <RAYSSA_INTEGRATION_TOKEN>
```

- Both sides read the token from an environment variable. It is never in source, never in a
  commit, never in this file.
- KARAY compares in **constant time** (`crypto.timingSafeEqual`) — a plain `===` on a secret
  leaks its length and prefix to a patient caller.
- Missing, malformed, or wrong token → `401` with a generic body. Never explain which.
- Every failed attempt is logged with timestamp, path, and source IP. Repeated failures are
  an alert, not a log line.
- Rate limit: 120 requests per minute per token. Exceeded → `429` with `Retry-After`.
- Rotating the token is a two-step deploy: KARAY accepts both old and new, RAYSSA switches,
  KARAY drops the old.

## Errors

Uniform shape on every non-2xx:

```json
{ "error": { "code": "unauthorized", "message": "Invalid credentials." } }
```

| Status | `code` | Meaning |
|---|---|---|
| 400 | `bad_request` | Malformed parameter |
| 401 | `unauthorized` | Missing or invalid token |
| 404 | `not_found` | No such model, or the model is not active |
| 429 | `rate_limited` | Too many requests |
| 500 | `internal_error` | KARAY-side failure. RAYSSA retries with backoff. |

`message` is for a human reading a log. **RAYSSA branches on `code`, never on `message`.**

---

## `GET /models`

The active roster. RAYSSA calls this every 15 minutes and immediately before the overnight
preparation job.

**Query parameters:** none. The endpoint returns only models where `active = true`;
filtering is KARAY's decision, not the caller's.

**Response `200`:**

```json
{
  "version": "v1",
  "generated_at": "2026-08-05T07:00:00.000Z",
  "models": [
    {
      "id": "8a3d2f1e-0000-4000-8000-000000000001",
      "stage_name": "Ana",
      "status": "active",
      "active": true,
      "representative_id": "c7b0e4d9-0000-4000-8000-000000000002",
      "daily_percentage": 64,
      "updated_at": "2026-08-04T19:22:11.000Z"
    }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | KARAY's model id. RAYSSA stores it as `karay_model_id`. **Stable forever** — RAYSSA's entire dataset hangs off it, so it must never be reissued or reused. |
| `stage_name` | string | Working name. Never the legal name. |
| `status` | string | KARAY's model status enum, as a string. |
| `active` | boolean | Always `true` in this response; present so the field exists when filtering changes. |
| `representative_id` | uuid \| null | Assignment only. RAYSSA never reads the rep's record. |
| `daily_percentage` | integer | 0–100, KARAY's daily-checklist projection. |
| `updated_at` | timestamptz | For change detection. |

**A model disappearing from this list does not mean delete.** RAYSSA sets `missing_since` and
keeps the row and everything referencing it. Models get deactivated and reactivated; a
deletion cascade triggered by one absent API response would destroy months of packet and
attribution history.

---

## `GET /models/:id/brand-profile`

Everything the generation prompts need. `404` if the model is unknown or not active.

**Response `200`:**

```json
{
  "version": "v1",
  "model_id": "8a3d2f1e-0000-4000-8000-000000000001",
  "brand_profile": {
    "display_name": "Ana",
    "niche_1": "fitness",
    "niche_2": "lifestyle",
    "niche_3": null,
    "primary_positioning": "approachable girl-next-door with a gym focus",
    "secondary_positioning": null,
    "ai_guidance": "Warm, playful, never crude. Portuguese first.",
    "default_languages": ["pt-BR", "en-US"],
    "target_gender": "male",
    "target_age_min": 25,
    "target_age_max": 45,
    "target_countries": ["BR", "US", "PT"],
    "target_languages": ["pt-BR", "en-US"],
    "target_interests": ["fitness", "football"],
    "markets_to_avoid": [],
    "daily_directive": "Push the new gym series.",
    "updated_at": "2026-08-01T12:00:00.000Z"
  }
}
```

Every field is nullable except `display_name`, `default_languages`, and `updated_at`.

**A model with a mostly-null brand profile is a data problem, not a code problem.** RAYSSA
surfaces it as a warning on the model's screen and generates what it can — it does not
invent positioning to fill the gap, and it does not fail the packet.

---

## `POST /models/:id/checklist`

The single write. Ticks one item on KARAY's daily checklist so the DAILY badge on
`/admin/models` reflects work RAYSSA recorded.

**Request:**

```json
{
  "item_key": "war_plan.x_posts",
  "completed": true,
  "completed_at": "2026-08-05T14:30:00.000Z",
  "source": "rayssa"
}
```

`item_key` must be one of the permanent keys in KARAY's `lib/daily/definition.ts` — the same
keys RAYSSA uses internally, which is why 3.6 exports that file as reference. An unknown key
is a `400`, never a silent no-op.

**Response `200`:**

```json
{ "version": "v1", "model_id": "…", "item_key": "war_plan.x_posts", "completed": true }
```

**Idempotent.** Sending the same tick twice is a success with an unchanged result — never a
double-count, never an error. RAYSSA retries on network failure without checking first, so
this property is load-bearing rather than a nicety.

KARAY records `source: "rayssa"` in its audit trail so the two systems' contributions stay
distinguishable after the fact.

---

## The mock

RAYSSA ships a mock implementing this contract, enabled by `KARAY_API_MOCK=true`. It returns
fixtures for five fake models with complete brand profiles and accepts checklist writes into
memory.

**RAYSSA must be fully developable, runnable, and testable with KARAY unreachable.** If any
task requires a live KARAY to make progress, the mock is incomplete — fix the mock rather
than reaching for real credentials.

The mock also serves the failure paths, and they must be exercised, not just present:
`KARAY_API_MOCK=timeout`, `=500`, `=401`, `=empty`. Acceptance criterion 14 depends on these
behaving correctly.

---

## Changelog

| Version | Date | Change |
|---|---|---|
| v1 | — | Initial contract. Not yet frozen; freezes when RAYSSA reaches production. |

# KarayModels — Automated Video Editor

## Phase 1: Architecture & Feasibility

> Status: plan pending owner approval. No production code will be changed until the plan is approved.

---

## 1. Feasibility Assessment

The system is **feasible**, but video rendering cannot run inside a Vercel serverless function (10–300 s timeout, 4.5 MB payload limit, no GPU, risk of memory/compute limits). The architecture must split:

- **Admin UI and API** → Next.js + Supabase + Vercel.
- **Queue and database** → Supabase Postgres.
- **Private storage** → Supabase Storage + Google Drive.
- **Rendering worker** → Fly.io / Railway / Google Cloud Run / Vercel Sandbox with FFmpeg.

The full feature list in the request requires post-MVP integrations (AI captions, stabilization, scene detection, etc.), but the core trim, crop, resize, watermark, lower third, color correction, and multi-platform export is achievable with FFmpeg today.

---

## 2. Comparison of Realistic Video Processing Options

| Option | Type | Pros | Cons | Recommended? |
|--------|------|------|------|--------------|
| **FFmpeg (self-hosted worker)** | CLI / C library | Very low cost, full control, no per-render royalties, supports cut, crop, resize, filters, text burn-in, concat, audio, subtitles, etc. | Requires operating your own worker, learning curve, AI captions need Whisper add-on, advanced stabilization is limited. | **Best choice for MVP and long term.** |
| **Remotion (React → video)** | Library + Lambda/Cloud Run/Vercel | Programmable in React/TS, great for animated titles/brand, good Node integration. | Not a classic clip editor (source video is an input asset), commercial license per render ($0.01/render, $100/mo min). | Good for programmatic titles, but more expensive than FFmpeg for raw processing. |
| **Shotstack** | SaaS API | Mature JSON API, templates, white-label, no infra management. | $0.20–$0.30/min, less control over advanced filters, third-party adult-content ToS risk. | Quick to start, but cost scales and platform risk exists. |
| **Cloudinary** | SaaS API | Basic transformations via URL, resize, crop, overlays, transcode, storage. | Not a timeline editor (cannot cut/combine multiple clips), per-minute costs, adult-content policies. | Useful for delivery/derivatives, not the main engine. |
| **Mux** | Video API | Excellent for streaming, thumbnails, transcoding. | Not a composition/brand/lower-third editor. | For final delivery, not editing. |
| **AWS MediaConvert** | AWS cloud | Robust, many codecs, scalable. | Complex, higher cost, dynamic overlays and advanced captions need extra pipeline. | Enterprise option, exceeds initial need. |
| **Google Cloud Video Intelligence** | ML/cloud | Analysis, scene detection, captions, labeling. | Does not render/edit. | Can be used as a pre-analysis step in Phase 5. |
| **CapCut / Jianying** | Desktop app + unofficial APIs | Familiar UI, popular templates. | **No official public server-side API.** Third-party projects (VectCutAPI, capcut-mcp-server) require the desktop app open, are fragile, have no SLA, and likely violate ToS. | **Not suitable for production.** |
| **Adobe Premiere / After Effects / Photoshop / Lightroom** | Desktop apps | Rich visual features. | None expose a public cloud REST API; automation requires an open desktop app with bridge/panel (CEP/UXP/ExtendScript) on Windows/Mac. | **Not suitable for cloud automation.** |
| **Runway ML** | Generative AI API | AI generation/editing. | Focused on generative AI, expensive, long queues, strict adult-content policies, not an assembly editor. | Not recommended for this pipeline. |
| **Vercel Sandbox** | Temporary microVMs | Can run FFmpeg in an isolated environment, scales to zero, integrated with Blob. | Preview/new product, time and disk limits, per-second VM cost, requires large file upload/download. | Viable worker alternative, but Fly.io/Railway are cheaper and more predictable for steady load. |

### Recommendation

- **Rendering engine**: FFmpeg in a dedicated Docker worker.
- **Orchestration + UI**: Next.js + Supabase.
- **Queue**: Postgres `video_jobs` table (or `pgmq` if reliable on Supabase).
- **Video delivery**: Supabase Storage (private) + optional Google Drive export.
- **Captions**: OpenAI Whisper / Whisper.cpp (installed on worker) or OpenAI Whisper API.
- **Voiceover**: ElevenLabs (only when configured).
- **Natural-language editing**: Anthropic Claude (already in project) with Zod-validated extraction.

---

## 3. Verdict on CapCut

**CapCut cannot be used reliably in production.**

- ByteDance/CapCut does not provide an official public server-side API for automated video rendering.
- Third-party projects (`VectCutAPI`, `capcut-mcp-server`, etc.) drive the desktop CapCut/Jianying application and are:
  - Brittle (break with UI updates).
  - Not scalable (requires a computer running the app).
  - Unsupported, unaudited, and likely against CapCut's Terms of Service.

**Decision: do not architect around CapCut. Build on FFmpeg + worker.**

---

## 4. Recommended Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Vercel (Next.js 16 App Router)                                       │
│  - /admin/editor-de-video (dashboard, templates, queue, models)         │
│  - /api/video/* (upload, enqueue, approve, reprocess, webhooks)       │
│  - Server Actions with Zod validation                                 │
└───────────────────────┬─────────────────────────────────────────────────┘
                        │ HTTPS / Row Level Security
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Supabase                                                             │
│  - Auth (profiles: owner, administrator, representative, model)        │
│  - Postgres: video_jobs, video_templates, video_assets, etc.           │
│  - Storage: private buckets `video-originals`, `video-edited`           │
└───────────────────────┬─────────────────────────────────────────────────┘
                        │ service role + queue
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Video Worker (Fly.io / Railway / Cloud Run)                            │
│  - Node.js + FFmpeg + Whisper (optional) + googleapis                   │
│  - Polls video_jobs table for status = queued                          │
│  - Downloads source (Supabase Storage or Google Drive)                  │
│  - Renders with FFmpeg according to template                            │
│  - Uploads result, updates status, writes logs and cost                 │
└───────────────────────┬─────────────────────────────────────────────────┘
                        │ OAuth service account
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Google Drive                                                          │
│  - Model-assigned folders (ONLY FANS, INSTAGRAM, etc.)                  │
│  - Optional subfolders: Originals, Processing, Edited, Errors, Archived │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Complete Processing Workflow

1. **Ingest**
   - Manual upload from admin, or
   - New file detected in Google Drive (poll or webhook).
2. **Validation & security**
   - Verify model and folder are authorized.
   - Validate MIME type, extension, and size.
   - Detect duplicates by hash/filename.
   - Confirm consent/contract status is complete.
3. **Job creation**
   - Insert `video_jobs` with status `new` or `awaiting_configuration`.
   - Assign default template from model or folder.
4. **Approval (if required)**
   - Owner/admin approves in the UI before continuing.
5. **Enqueue**
   - Set status `queued`.
6. **Download & prep**
   - Worker downloads to `/tmp`.
   - Status `downloading` → `preparing`.
7. **Natural-language instruction parsing (optional)**
   - Claude converts free-text to a Zod-validated editing-parameters object.
   - Owner reviews/adjusts before proceeding (if `approval_required`).
8. **Rendering**
   - FFmpeg applies filters, cuts, resize, text, watermark, captions, audio, etc.
   - Status `processing` → `rendering`.
9. **Upload & delivery**
   - Upload to Supabase Storage and/or Google Drive.
   - Status `sending` → `completed`.
10. **Notifications & logs**
    - Write `video_processing_logs` and `video_processing_errors`.
    - Update dashboard with status, duration, cost.
    - On failure, retry with limited backoff.

---

## 6. Database Plan (Supabase Postgres)

### New enums

```sql
video_job_status: new, awaiting_configuration, awaiting_approval, queued,
                  downloading, preparing, processing, rendering_captions,
                  rendering, sending, completed, failed, cancelled
video_source_type: manual_upload, google_drive
video_platform: instagram_reels, instagram_stories, tiktok, youtube_shorts,
                x, reddit, onlyfans, fansly, custom
video_aspect: vertical_9_16, square_1_1, portrait_4_5, landscape_16_9, original
```

### Tables

| Table | Purpose | Keys / notes |
|-------|---------|--------------|
| `video_integrations` | Connected Google Drive accounts and encrypted OAuth tokens. | PK `id`, `provider`, `owner_id`, `credentials_encrypted`, `created_at`. |
| `video_source_folders` | Drive folders linked to models and templates. | PK `id`, FK `model_id`, `folder_id`, `platform`, `template_id`, `last_sync_at`. |
| `video_assets` | Record of each source file (manual or Drive). | PK `id`, FK `model_id`, `source_type`, `original_path`, `drive_file_id`, `hash`, `status`. |
| `video_jobs` | Processing queue. | PK `id`, FK `asset_id`, `template_id`, `created_by`, `status`, `progress`, `retry_count`, `cost_estimate`, `cost_actual`, `error_log`. |
| `video_job_outputs` | Rendered versions per platform. | PK `id`, FK `job_id`, `platform`, `resolution`, `file_path`, `drive_file_id`, `file_size`, `duration`. |
| `video_templates` | Editing templates. | PK `id`, `name`, `target_platform`, `aspect`, `settings` (JSONB), `is_active`, `is_global`, `model_id`, `folder_id`. |
| `video_template_versions` | Template change history. | PK `id`, FK `template_id`, `version`, `settings`, `changed_by`, `created_at`. |
| `video_instructions` | Natural-language instructions and structured interpretation. | PK `id`, FK `job_id`, `raw_text`, `parsed_json` (validated), `approved_by`, `approved_at`. |
| `video_brand_assets` | Logos, intros, outros, approved music. | PK `id`, `type`, `storage_path`, `usage_license`, `is_active`. |
| `video_processing_logs` | Structured logs. | PK `id`, FK `job_id`, `level`, `message`, `metadata`, `created_at`. |
| `video_processing_errors` | Specific errors and concise stack traces. | PK `id`, FK `job_id`, `error_code`, `message`, `retryable`. |
| `video_approvals` | Job/result approval records. | PK `id`, FK `job_id`, `approved_by`, `decision`, `notes`, `created_at`. |
| `video_usage` | Cost and limits tracking. | PK `id`, FK `model_id`, `month`, `storage_bytes`, `transcode_seconds`, `estimated_cost`, `currency`. |
| `video_notifications` | Pending/read dashboard notifications. | PK `id`, FK `recipient_id`, `type`, `message`, `read`, `created_at`. |

### RLS policies (base)

- `owner`: full access to all video tables.
- `administrator`: read/write everywhere except deleting critical global settings without owner.
- `representative`: no access by default (to be added later with explicit permission).
- `model`: read only `video_jobs` / `video_job_outputs` linked to their own `model_id` and marked `visible_to_model`; no access to other models' templates, costs, or configurations.

All new tables will have RLS enabled and reuse existing helpers (`is_staff()`, `is_owner()`, etc.).

---

## 7. Security Plan

- **Private buckets**: `video-originals` and `video-edited` with `public = false`.
- **Signed URLs**: short expiration (5–15 min) for preview/download.
- **OAuth**: Google Drive tokens encrypted (`SOCIAL_TOKEN_ENCRYPTION_KEY`) in the database; never in the client.
- **Service keys**: only in the worker and Server Actions/API routes; never in React components.
- **Validation**: Zod for all inputs; whitelist MIME types and extensions; configurable max size.
- **Safe execution**: FFmpeg receives only pre-validated arguments; no shell string concatenation; no commands generated by the LLM are executed.
- **Worker isolation**: container with minimal network access; read/write only in `/tmp`.
- **Duplicate prevention**: SHA-256 file hash to avoid reprocessing.
- **Audit**: every action inserts a `video_processing_logs` row.
- **Consent gate**: job only starts if `model_checklist.model_release_status` and `contract_status` are `completed`; admins can place a model/folder on hold.
- **Malware checks**: signature/MIME validation; optionally ClamAV in the worker.
- **Path traversal**: storage paths built from database IDs, never from original filenames.
- **Deletion/archival**: lifecycle rules in Storage and `archived_at` flag in the database.

---

## 8. Google Drive Integration Plan

### Detection options

1. **Google Drive Push Notifications (webhook)** — recommended when a verified custom domain and HTTPS certificate are available.
   - Channel expires in 7 days and must be renewed.
   - Requires endpoint `/api/webhooks/google-drive`.
2. **Polling with `changes.list` + `startPageToken`** — simple, robust fallback.
   - Worker Edge Function or cron runs every N minutes.
   - Store `last_sync_at` and `drive_page_token` in `video_source_folders`.
   - Process only supported video MIME types in authorized folders.

### Safe flow

1. Existing service account (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`).
2. Map `folder_id` → `model_id` → `platform`.
3. List files: query `mimeType contains 'video/' and trashed = false`.
4. For each new file:
   - Check if `drive_file_id` already exists in `video_assets` (duplicate).
   - Get metadata (`name`, `size`, `mimeType`, `md5Checksum`, `createdTime`).
   - Insert `video_assets` and `video_jobs` with status `new`.
5. Final result upload:
   - Create/use `Vídeos Editados` subfolder inside the model's folder.
   - Record `drive_file_id` in `video_job_outputs`.

---

## 9. Cost Estimate (MVP)

| Item | Option | Estimated monthly cost |
|------|--------|------------------------|
| Worker hosting | Fly.io / Railway (1 CPU, 2 GB) | $15–$30 |
| Supabase Storage | 50 GB source + 50 GB edited | Free tier or ~$5 |
| Data transfer | Video egress | $5–$20 (usage dependent) |
| Captions (Whisper) | Local worker | $0 (CPU) or OpenAI API $0.006/min |
| Voiceover (ElevenLabs) | Optional | ~$5–$22/mo if used |
| Claude natural-language | Anthropic API | Sporadic, ~$2–$10/mo |
| Supabase Edge Functions / cron | Polling scheduler | Within current plan |
| **Estimated MVP total** | | **$25–$70/mo** |

For comparison, Shotstack at $0.20/min: 100 min/mo = $20; at higher volume, FFmpeg is cheaper and gives full control.

---

## 10. Phased Implementation

### Phase 1 — Architecture & approval (current)

- [x] Repo inspection.
- [x] API research.
- [ ] Approve this plan.

### Phase 2 — Minimum Viable Product

1. Database migration with core tables (`video_templates`, `video_assets`, `video_jobs`, `video_job_outputs`, `video_processing_logs`).
2. Create private buckets `video-originals` and `video-edited`.
3. RLS on new tables.
4. `/admin/editor-de-video` page with:
   - Manual upload.
   - Jobs table with status.
   - Simple template creation screen.
   - Original and result preview.
   - Approve / reject / reprocess buttons.
5. Server Actions/API routes:
   - `POST /api/video/jobs` (create job from upload).
   - `POST /api/video/jobs/[id]/approve`.
   - `POST /api/video/jobs/[id]/reprocess`.
6. Node.js + FFmpeg worker in Docker (local + Fly.io/Railway):
   - Poll `video_jobs`.
   - Render with template: trim, crop/resize, lower third, watermark, basic color, burned-in captions.
   - Upload result to Supabase Storage.
   - Update status and logs.

### Phase 3 — Google Drive Automation

- Connect Drive folders to models.
- Polling `changes.list` for new videos.
- Duplicate prevention.
- Auto-create jobs.
- Deliver result back to Drive.
- Error/disconnect notifications.

### Phase 4 — Advanced Templates & AI

- Multiple templates, model-specific and folder-specific.
- Natural-language instruction box with Claude → Zod → approval.
- Auto captions with Whisper in PT/EN/ES.
- Platform presets (resolution, aspect, bitrate, safe zones).
- Branding preview.

### Phase 5 — Optimization

- Smart highlight, silence/scene detection, auto-reframing, batch processing, advanced cost reporting.

---

## 11. Expected Files (Phase 2)

- `supabase/migrations/20260725000004_video_editor_schema.sql`
- `supabase/migrations/20260725000005_video_editor_rls.sql`
- `lib/video/types.ts`
- `lib/video/templates.ts`
- `lib/video/ffmpeg.ts` (argument schema)
- `lib/video/jobs.ts` (Server Actions for create/approve/reprocess)
- `app/admin/editor-de-video/page.tsx`
- `app/admin/editor-de-video/templates/page.tsx`
- `app/admin/editor-de-video/jobs/page.tsx`
- `app/api/video/jobs/route.ts`
- `app/api/video/jobs/[id]/approve/route.ts`
- `app/api/video/jobs/[id]/reprocess/route.ts`
- `worker/Dockerfile`
- `worker/package.json`
- `worker/src/index.ts`
- `worker/src/ffmpeg.ts`
- `worker/src/storage.ts`
- `.env.example` (new variables)

---

## 12. Required Environment Variables

```bash
# Existing (already present)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=

# New
SUPABASE_VIDEO_ORIGINAIS_BUCKET=video-originals
SUPABASE_VIDEO_EDITADOS_BUCKET=video-edited
VIDEO_WORKER_API_KEY=           # shared secret between worker and API for webhooks
GOOGLE_DRIVE_WATCH_CHANNEL_ID=  # optional, for webhook
GOOGLE_DRIVE_WEBHOOK_SECRET=    # optional
WHISPER_PROVIDER=local|openai   # default local
OPENAI_API_KEY=                 # if using Whisper API
ELEVENLABS_API_KEY=             # if using voiceover
VIDEO_MAX_FILE_SIZE_MB=2048
VIDEO_MAX_DURATION_SECONDS=600
VIDEO_WORKER_CONCURRENCY=2
VIDEO_WORKER_POLL_INTERVAL_MS=15000
```

---

## 13. Risks & Limitations

- **Risk**: FFmpeg has a steep learning curve for complex animations; advanced animated titles may need Remotion or After Effects in Phase 5.
- **Risk**: Third-party adult-content restrictions (Cloudinary, Runway, etc.); self-hosted FFmpeg avoids this.
- **Risk**: Heavy processing can exhaust worker disk/memory; concurrency will be set to 1–2 and file size/duration capped.
- **Limitation**: Vercel Functions will not render video. Worker deployment is separate.
- **Limitation**: Auto captions may have errors; they will be burned only after approval in Phase 4.
- **Limitation**: Google Drive webhooks require a verified domain and periodic renewal; polling is the initial fallback.

---

## 14. Decisions Blocking Implementation

1. **Architecture approval**: Can we proceed with FFmpeg + worker on Fly.io/Railway/Cloud Run?
2. **Worker hosting**: Which do you prefer — Fly.io, Railway, Google Cloud Run, or Vercel Sandbox?
3. **Google Drive folder structure**: Keep `ONLY FANS` and `INSTAGRAM` flat, or create subfolders (`Originals`, `Processing`, `Edited`, `Errors`, `Archived`)?
4. **Captions**: Use local Whisper on the worker (no per-minute cost, CPU-bound) or OpenAI Whisper API?
5. **Brand assets**: Please provide the KarayModels logo PNG/SVG and the default font for lower thirds.
6. **Cost cap**: What is the acceptable monthly budget to trigger auto-suspension?
7. **Mandatory approval**: Should every job require manual approval before final render, or can some templates auto-render?
8. **Model submissions**: Can models upload videos in the MVP, or only owner/admin?

---

## 15. Next Steps

Once you approve this plan and answer the questions above, I will start Phase 2 (MVP):

1. Database migration.
2. Private buckets.
3. `/admin/editor-de-video` page.
4. Server Actions for job creation/management.
5. Minimal FFmpeg worker in a container.
6. Manual tests: upload → queue → render → secure preview.

Nothing will be merged without your review.

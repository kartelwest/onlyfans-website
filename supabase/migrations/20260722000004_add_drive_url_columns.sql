-- =============================================================================
-- Add drive_photos_url and drive_videos_url columns to models table
-- These are plain text fields for Google Drive folder links, set by admin.
-- Both nullable, optional. No other columns are touched.
-- =============================================================================

alter table public.models
  add column if not exists drive_photos_url text,
  add column if not exists drive_videos_url text;

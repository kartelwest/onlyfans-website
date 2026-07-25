-- Add daily AI directive field to brand_profiles for the Amplia strategy tab.

alter table public.brand_profiles
  add column if not exists daily_directive text;

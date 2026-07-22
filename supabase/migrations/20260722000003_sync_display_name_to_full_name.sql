-- =============================================================================
-- Sync models.display_name to mirror profiles.full_name
-- Source of truth: profiles.full_name
-- display_name is kept in sync automatically via trigger.
-- =============================================================================

-- a) Backfill: set display_name = full_name for all existing models
UPDATE public.models m
SET display_name = p.full_name
FROM public.profiles p
WHERE m.profile_id = p.id
  AND p.full_name IS NOT NULL
  AND btrim(p.full_name) <> ''
  AND m.display_name IS DISTINCT FROM p.full_name;

-- b) Trigger: after INSERT or UPDATE of full_name on profiles,
--    update the linked model's display_name.
--    If full_name is null/blank, leave display_name unchanged (NOT NULL constraint).
CREATE OR REPLACE FUNCTION public.sync_model_display_name()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.full_name IS NOT NULL AND btrim(NEW.full_name) <> '' THEN
    UPDATE public.models
    SET display_name = NEW.full_name
    WHERE profile_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_model_display_name ON public.profiles;
CREATE TRIGGER trg_sync_model_display_name
  AFTER INSERT OR UPDATE OF full_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_model_display_name();

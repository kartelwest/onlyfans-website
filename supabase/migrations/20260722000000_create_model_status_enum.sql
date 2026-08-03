-- =============================================================================
-- KARAY Models — model_status enum
--
-- Several later migrations add values to this enum, but the enum creation
-- migration was missing from the repository. Creating it here keeps clean local
-- resets working while remaining safe for production (if not exists).
-- =============================================================================

do $$ begin
  create type public.model_status as enum (
    'candidate',
    'active',
    'inactive',
    'denied',
    'not_started'
  );
exception when duplicate_object then null;
end $$;

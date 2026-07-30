-- =============================================================================
-- The admin models list offers "Negada" (denied) as a status for candidates,
-- and /api/models/status accepts it (VALID_STATUSES in app/api/models/status),
-- but the value was missing from the model_status enum. Denying a candidate
-- therefore failed with 22P02 (invalid input value for enum model_status) and
-- the change was never saved.
-- =============================================================================
alter type model_status add value if not exists 'denied' after 'inactive';

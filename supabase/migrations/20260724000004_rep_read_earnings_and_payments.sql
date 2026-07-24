-- =============================================================================
-- KARAY Models — representatives can read earnings + payment splits
--
-- The Model Dashboard rep view (Section 2 — "Seus ganhos este mês") needs
-- real numbers, not a permanent $0 placeholder. model_documents,
-- model_platforms, and model_drive_folders already grant assigned
-- representatives read access via `is_assigned_representative(model_id)`;
-- model_payments and model_earnings_reports were missing the equivalent
-- policy (staff-only until now), which silently made these tables return
-- zero rows for a representative regardless of actual data. Mirrors the
-- existing pattern exactly — read-only, assigned models only, no write.
-- =============================================================================

drop policy if exists "representatives can view payments" on public.model_payments;
create policy "representatives can view payments" on public.model_payments
  for select to authenticated
  using (is_assigned_representative(model_id));

drop policy if exists "representatives can view earnings reports" on public.model_earnings_reports;
create policy "representatives can view earnings reports" on public.model_earnings_reports
  for select to authenticated
  using (is_assigned_representative(model_id));

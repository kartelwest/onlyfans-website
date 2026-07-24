-- =============================================================================
-- KARAY Models — model can read her own payment split
--
-- The Model Dashboard's Section 2 earnings card needs the model's own
-- revenue-split percentages when she views her own dashboard.
-- model_payments had no is_own_model policy at all (staff-only, then
-- assigned-rep as of 20260724000004) — add read-only access for the model's
-- own row.
-- =============================================================================

drop policy if exists "models can view own payments" on public.model_payments;
create policy "models can view own payments" on public.model_payments
  for select to authenticated
  using (private.is_own_model(model_id));

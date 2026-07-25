-- Lock Amplia data to owner/administrator only.
-- Replaces the brand-team helpers so that representatives, models, and any
-- brand-only roles cannot read or write Brand Growth tables.

create or replace function public.is_brand_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
$$;

create or replace function public.is_brand_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
$$;

create or replace function public.can_manage_brand_talent(target_talent uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
$$;

create or replace function public.is_assigned_to_talent(target_talent uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff()
$$;

grant execute on function
  public.is_brand_staff(),
  public.is_brand_editor(),
  public.can_manage_brand_talent(uuid),
  public.is_assigned_to_talent(uuid)
to authenticated;

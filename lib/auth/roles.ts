import type { ManagementRole } from "@/types/model";

/**
 * The single definition of who counts as staff.
 *
 * Staff sits ABOVE a representative in every direction: anything a rep may see
 * or do on a model, an owner or an administrator may too. Where a page is
 * built for reps alone, staff are sent to the equivalent admin screen instead
 * of being turned away like an outsider — the one thing they must never be is
 * treated as having LESS access than a rep.
 */
export const STAFF_ROLES: ManagementRole[] = ["owner", "administrator"];

export function isStaffRole(role: ManagementRole | null | undefined): boolean {
  return role ? STAFF_ROLES.includes(role) : false;
}

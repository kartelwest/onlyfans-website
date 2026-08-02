"use client";

import OnboardingChecklistPanel from "@/components/onboarding/OnboardingChecklistPanel";

import type { ManagementRole } from "@/types/model";

type ChecklistTabProps = {
  modelId: string;
  /** Kept for the caller's existing prop shape; the panel loads its own data. */
  checklist?: unknown;
  currentUserRole: ManagementRole;
};

export default function ChecklistTab({
  modelId,
  currentUserRole,
}: ChecklistTabProps) {
  return (
    <OnboardingChecklistPanel
      modelId={modelId}
      currentUserRole={currentUserRole}
    />
  );
}

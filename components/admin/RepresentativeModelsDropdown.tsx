import Link from "next/link";

import { normalizeModelStatus } from "@/lib/models/modelStatusOrder";
import type { ModelStatus } from "@/types/model";

export type RepresentativeModel = {
  id: string;
  slug: string;
  display_name: string;
  stage_name: string | null;
  status: string | null;
  active: boolean | null;
  onboarding_percentage: number | null;
};

const statusDot: Record<ModelStatus, string> = {
  active: "bg-emerald-400",
  inactive: "bg-white/40",
  candidate: "bg-yellow-400",
  denied: "bg-red-400",
};

/**
 * The representative's models, one click away from her row.
 *
 * Each model opens as SHE sees it — that is the point of the list: the way to
 * reach a rep's model pages is through the rep's own view of them, not through
 * the admin screen for the same model (which is one more click away, from the
 * banner up top).
 *
 * A <details> element, so the dropdown works with no client JavaScript at all.
 */
export default function RepresentativeModelsDropdown({
  representativeId,
  models,
}: {
  representativeId: string;
  models: RepresentativeModel[];
}) {
  if (models.length === 0) {
    return (
      <p className="text-xs text-white/40">Nenhuma modelo atribuída</p>
    );
  }

  return (
    <details className="group/models w-full min-w-[220px]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white/80 transition hover:bg-white/10 [&::-webkit-details-marker]:hidden">
        <span>
          {models.length} modelo(s)
        </span>

        <svg
          viewBox="0 0 20 20"
          fill="none"
          className="h-3.5 w-3.5 shrink-0 text-white/50 transition-transform group-open/models:rotate-90"
        >
          <path
            d="M7 4l6 6-6 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </summary>

      <div className="mt-2 space-y-1 rounded-lg border border-white/10 bg-black/30 p-2">
        {models.map((model) => {
          const status = normalizeModelStatus(model.status, model.active);

          return (
            <Link
              key={model.id}
              href={`/admin/view-as/model/${model.id}/representative`}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-xs transition hover:bg-white/10"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${statusDot[status]}`}
                />

                <span className="truncate font-semibold text-white/85">
                  {model.stage_name?.trim() || model.display_name}
                </span>
              </span>

              <span className="shrink-0 text-white/45">
                {model.onboarding_percentage ?? 0}%
              </span>
            </Link>
          );
        })}

        <Link
          href={`/admin/view-as/representative/${representativeId}`}
          className="mt-1 block rounded-md border border-purple-400/30 bg-purple-500/10 px-2 py-2 text-center text-xs font-bold text-purple-200 transition hover:bg-purple-500/20"
        >
          Abrir a tela do representante
        </Link>
      </div>
    </details>
  );
}

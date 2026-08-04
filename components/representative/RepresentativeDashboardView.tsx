import Link from "next/link";
import { useTranslations } from "next-intl";

import { normalizeModelStatus } from "@/lib/models/modelStatusOrder";
import type { ModelStatus } from "@/types/model";

export type RepresentativeDashboardModel = {
  id: string;
  display_name: string;
  stage_name: string | null;
  instagram: string | null;
  whatsapp: string | null;
  onboarding_percentage: number;
  status: string | null;
  active: boolean;
  last_login_at: string | null;
};

// The colour is presentation; the label it sits next to is UI copy and comes
// from `enums.modelStatus`, keyed by the same database value.
const statusDotConfig: Record<ModelStatus, string> = {
  active: "bg-green-500",
  inactive: "bg-gray-400",
  candidate: "bg-yellow-400",
  denied: "bg-red-500",
};

/**
 * The representative's home screen.
 *
 * Shared by the rep's own /representative and by the admin preview of it, so
 * what an admin checks is the screen the rep actually gets — including the
 * onboarding button, which is the whole reason to look: it is the proof that
 * this rep can onboard her models.
 *
 * The two callers differ only in where the cards point, which is what `hrefs`
 * is for.
 */
export default function RepresentativeDashboardView({
  representativeName,
  models,
  hrefs,
}: {
  representativeName: string;
  models: RepresentativeDashboardModel[];
  hrefs: {
    model: (model: RepresentativeDashboardModel) => string;
    onboarding: (model: RepresentativeDashboardModel) => string;
  };
}) {
  const t = useTranslations("representative.dashboard");
  const tStatus = useTranslations("enums.modelStatus");

  return (
    <main className="min-h-screen bg-[#f7f1ec] px-6 py-12">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#b06a87]">
              KARAY Models
            </p>

            <h1 className="mt-3 text-4xl font-bold text-[#4b2438]">
              {t("title")}
            </h1>

            <p className="mt-3 text-[#765c68]">
              {t("welcome", { name: representativeName })}
            </p>
          </div>

          <div className="text-sm text-[#765c68]">
            {t("assignedCount", { count: models.length })}
          </div>
        </div>

        {models.length === 0 ? (
          <div className="rounded-2xl border border-[#eadfd8] bg-white p-8 text-center">
            <p className="text-[#765c68]">
              {t("noModels")}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => {
              const modelStatus = normalizeModelStatus(
                model.status,
                model.active,
              );

              const statusDotClass = statusDotConfig[modelStatus];

              const percentage = Math.min(
                Math.max(model.onboarding_percentage ?? 0, 0),
                100,
              );

              return (
                <div
                  key={model.id}
                  className="rounded-2xl border border-[#eadfd8] bg-white p-6 shadow-sm transition hover:border-[#b06a87] hover:shadow-md"
                >
                  <Link
                    href={hrefs.model(model)}
                    className="flex items-center justify-between gap-4"
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#eadfd8] bg-[#f7f1ec] text-2xl font-bold text-[#4b2438]">
                      {model.display_name.charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-lg font-bold text-[#4b2438]">
                        {model.display_name}
                      </h3>

                      {model.stage_name && (
                        <p className="text-sm text-[#765c68]">
                          {model.stage_name}
                        </p>
                      )}
                    </div>

                    <div
                      title={tStatus(modelStatus)}
                      className={`h-3 w-3 shrink-0 rounded-full ${statusDotClass}`}
                    />
                  </Link>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#765c68]">{t("onboarding")}</span>

                      <span className="font-semibold text-[#4b2438]">
                        {model.onboarding_percentage}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-[#eadfd8]">
                      <div
                        className={`h-full rounded-full ${
                          percentage === 100
                            ? "bg-green-500"
                            : percentage > 0
                              ? "bg-yellow-400"
                              : "bg-red-400"
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    {model.last_login_at && (
                      <p className="mt-2 text-xs text-[#765c68]">
                        Último acesso:{" "}
                        {new Date(model.last_login_at).toLocaleDateString(
                          "pt-BR",
                        )}
                      </p>
                    )}
                  </div>

                  <Link
                    href={hrefs.onboarding(model)}
                    className="mt-4 block rounded-xl border border-[#b06a87] px-4 py-2 text-center text-sm font-semibold text-[#b06a87] transition hover:bg-[#b06a87] hover:text-white"
                  >
                    {model.onboarding_percentage === 100
                      ? "Ver onboarding"
                      : "Preencher onboarding"}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

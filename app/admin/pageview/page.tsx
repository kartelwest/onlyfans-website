import Link from "next/link";
import { redirect } from "next/navigation";

import { isStaffRole } from "@/lib/auth/roles";
import {
  normalizeModelStatus,
  sortByModelStatus,
} from "@/lib/models/modelStatusOrder";
import { createClient } from "@/lib/supabase/server";
import type { ManagementRole, ModelStatus } from "@/types/model";

import { getLocale, getTranslations } from "next-intl/server";

import { formatCalendarDate } from "@/lib/earnings/period";
import { toLocale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

/**
 * Pageview — the screen a model is looking at while she is on the phone.
 *
 * Pick her here, see exactly what she sees, then switch to the admin side of
 * the same model from the banner without going back and hunting for her again.
 */

type PageviewModelRow = {
  id: string;
  model_number: number | null;
  slug: string;
  display_name: string;
  stage_name: string | null;
  status: string | null;
  active: boolean | null;
  last_login_at: string | null;
  representative_id: string | null;
  profile: { full_name: string | null } | null;
};

const statusStyles: Record<
  ModelStatus,
  { dot: string; text: string }
> = {
  active: { dot: "bg-emerald-400", text: "text-emerald-300" },
  inactive: { dot: "bg-white/40", text: "text-white/50" },
  candidate: { dot: "bg-yellow-400", text: "text-yellow-300" },
  denied: { dot: "bg-red-400", text: "text-red-300" },
};

export default async function AdminPageviewPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = (q ?? "").trim();

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !profile.active) {
    redirect("/login");
  }

  if (!isStaffRole(profile.role as ManagementRole)) {
    redirect("/login");
  }

  const { data: modelRows, error: modelsError } = await supabase
    .from("models")
    .select(
      `
        id,
        model_number,
        slug,
        display_name,
        stage_name,
        status,
        active,
        last_login_at,
        representative_id,
        profile:profiles!profile_id ( full_name )
      `,
    )
    .order("model_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (modelsError) {
    console.error("Failed to load models:", modelsError);
  }

  const models = sortByModelStatus(
    (modelRows ?? []) as unknown as PageviewModelRow[],
    (model) => ({ status: model.status, active: model.active }),
  );

  // Representative names are fetched separately, NOT through an embedded
  // profiles!representative_id join: production has no foreign key on that
  // column, so PostgREST cannot resolve the relationship and answers PGRST200
  // for the whole query — which is exactly how this page failed in production.
  const representativeIds = Array.from(
    new Set(
      models
        .map((model) => model.representative_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const { data: representativeRows } =
    representativeIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", representativeIds)
      : { data: [] };

  const representativeNames = new Map<string, string>(
    (representativeRows ?? []).map((row) => [
      row.id as string,
      ((row.full_name as string | null) ?? "").trim(),
    ]),
  );

  const needle = search.toLowerCase();

  const filteredModels = needle
    ? models.filter((model) =>
        [
          model.display_name,
          model.stage_name,
          model.profile?.full_name,
          model.representative_id
            ? representativeNames.get(model.representative_id)
            : null,
          model.model_number === null ? null : `#${model.model_number}`,
        ]
          .filter((field): field is string => Boolean(field))
          .some((field) => field.toLowerCase().includes(needle)),
      )
    : models;

  const t = await getTranslations("admin.pageview");
  const tCommon = await getTranslations("common.actions");
  const tStatus = await getTranslations("enums.modelStatus");
  const locale = toLocale(await getLocale());

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1400px]">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
              KARAY Models
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Pageview</h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
              {t("intro")}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/models"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              {t("modelList")}
            </Link>

            <Link
              href="/admin/representatives"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              {t("representatives")}
            </Link>
          </div>
        </header>

        <form
          method="get"
          className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-[#111115] p-4"
        >
          <label
            htmlFor="pageview-search"
            className="text-xs font-bold uppercase tracking-[0.12em] text-white/50"
          >
            {t("searchLabel")}
          </label>

          <input
            id="pageview-search"
            name="q"
            defaultValue={search}
            placeholder={t("searchPlaceholder")}
            className="min-w-[260px] flex-1 rounded-lg border border-white/15 bg-[#1a1a1f] px-4 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-pink-400/60"
          />

          <button
            type="submit"
            className="rounded-lg bg-pink-500 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-pink-400"
          >
            {tCommon("search")}
          </button>

          {search && (
            <Link
              href="/admin/pageview"
              className="rounded-lg border border-white/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white/70 transition hover:bg-white/10"
            >
              {tCommon("clear")}
            </Link>
          )}

          <span className="text-xs text-white/40">
            {t("count", {
              shown: filteredModels.length,
              total: models.length,
            })}
          </span>
        </form>

        {filteredModels.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-[#111115] p-12 text-center">
            <p className="text-lg font-bold">{t("noneFound")}</p>

            <p className="mt-2 text-sm text-white/50">
              {search
                ? t("tryAnother")
                : t("empty")}
            </p>
          </div>
        ) : (
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredModels.map((model) => {
              const status = normalizeModelStatus(model.status, model.active);
              const style = statusStyles[status];

              const displayName =
                model.profile?.full_name?.trim() || model.display_name;

              return (
                <article
                  key={model.id}
                  className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#111115] p-5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold">
                          {displayName}
                        </p>

                        {model.stage_name &&
                          model.stage_name !== displayName && (
                            <p className="mt-1 truncate text-xs text-white/45">
                              {model.stage_name}
                            </p>
                          )}
                      </div>

                      <span className="shrink-0 text-sm font-bold text-pink-300">
                        {model.model_number === null
                          ? ""
                          : `#${model.model_number}`}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold">
                      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                      <span className={style.text}>{tStatus(status)}</span>
                    </div>

                    <dl className="mt-4 space-y-1 text-xs text-white/50">
                      <div className="flex justify-between gap-3">
                        <dt>{t("representative")}</dt>
                        <dd className="truncate text-white/70">
                          {(model.representative_id
                            ? representativeNames.get(
                                model.representative_id,
                              )
                            : "") || t("none")}
                        </dd>
                      </div>

                      <div className="flex justify-between gap-3">
                        <dt>{t("lastAccess")}</dt>
                        <dd className="text-white/70">
                          {model.last_login_at
                            ? formatCalendarDate(
                                model.last_login_at.slice(0, 10),
                                locale,
                              )
                            : t("never")}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="mt-5 flex flex-col gap-2">
                    <Link
                      href={`/admin/view-as/model/${model.id}`}
                      className="rounded-lg bg-pink-500 px-4 py-2 text-center text-xs font-bold uppercase tracking-wider text-white transition hover:bg-pink-400"
                    >
                      {t("viewModelScreen")}
                    </Link>

                    <div className="grid grid-cols-2 gap-2">
                      <Link
                        href={`/admin/view-as/model/${model.id}/representative`}
                        className="rounded-lg border border-purple-400/30 bg-purple-500/10 px-3 py-2 text-center text-xs font-bold text-purple-200 transition hover:bg-purple-500/20"
                      >
                        {t("repScreen")}
                      </Link>

                      <Link
                        href={`/admin/models/${model.slug}`}
                        className="rounded-lg border border-pink-400/30 bg-pink-500/10 px-3 py-2 text-center text-xs font-bold text-pink-200 transition hover:bg-pink-500/20"
                      >
                        {t("adminPanel")}
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}

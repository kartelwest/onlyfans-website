import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { requireAdminAmpliaAccess } from "@/lib/amplia/admin";
import { getAmpliaClients, type AmpliaClient } from "@/lib/amplia/clients";

export const dynamic = "force-dynamic";

export default async function AdminSocialMediaOverviewPage() {
  await requireAdminAmpliaAccess();

  const { clients, stats } = await getAmpliaClients();

  const t = await getTranslations("admin.amplia");

  return (
    <main className="min-h-screen bg-[#08080a] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
              {t("portal")}
            </p>

            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
              {t("overview")}
            </h1>

            <p className="mt-2 text-sm text-white/55">
              {t("subtitle")}
            </p>
          </div>

          <Link
            href="/admin/socialmediamodels/models"
            className="rounded-xl bg-pink-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-pink-400"
          >
            {t("openAmplia")}
          </Link>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label={t("metrics.activeModels")} value={stats.activeSocialModels} description={t("descriptions.active")} />
          <MetricCard label={t("metrics.brandGrowthOnly")} value={stats.brandGrowthOnlyClients} description={t("descriptions.nonOnlyFans")} />
          <MetricCard label={t("metrics.instagramConnected")} value={stats.connectedInstagram} description={t("descriptions.activeAccounts")} />
          <MetricCard label={t("metrics.awaitingLaunch")} value={stats.awaitingLaunch} description={t("descriptions.setupPending")} />
          <MetricCard label={t("metrics.awaitingAuthorization")} value={stats.awaitingAuthorization} description={t("descriptions.oauthVerification")} />
          <MetricCard label={t("metrics.contentApproval")} value={stats.contentAwaitingApproval} description={t("descriptions.clientAgency")} />
          <MetricCard label={t("metrics.postsToday")} value={stats.postsScheduledToday} description={t("descriptions.instagram")} />
          <MetricCard label={t("metrics.playbookDone")} value={stats.playbookCompletedToday} description={t("descriptions.xManual")} />
          <MetricCard label={t("metrics.playbookPending")} value={stats.playbookPendingToday} description={t("descriptions.xManual")} />
          <MetricCard label={t("metrics.publishFailures")} value={stats.publishingFailures24h} description={t("descriptions.needsAttention")} />
          <MetricCard label={t("metrics.belowBaseline")} value={stats.accountsNeedingAttention} description={t("descriptions.restrictedSuspended")} />
          <MetricCard label={t("metrics.criticalAlerts")} value={stats.criticalAlerts} description={t("descriptions.immediateAction")} />
        </section>

        <section className="mt-8 rounded-2xl border border-pink-400/20 bg-[#111115] p-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-pink-100">
            {t("monthlySummary")}
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <MetricCard label={t("metrics.followerGrowth")} value={stats.recentFollowerGrowth} description={t("descriptions.last30Days")} />
            <MetricCard label={t("metrics.contentShortage")} value={stats.contentShortages} description={t("descriptions.lowStock")} />
            <MetricCard label={t("metrics.aiCost")} value={stats.estimatedAICostMonth} description={t("descriptions.thisMonthUsd")} />
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-[#111115] p-6">
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-pink-100">
            {t("clientsHeading")}
          </h2>

          <div className="mt-4 divide-y divide-white/5">
            {clients.length > 0 ? (
              clients.map((client) => (
                <ClientAccordion key={client.talentId} client={client} />
              ))
            ) : (
              <p className="py-6 text-sm text-white/45">
                {t("empty")}
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number | string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111115] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45">{label}</p>
      <p className="mt-3 text-3xl font-bold text-pink-300">{value}</p>
      <p className="mt-2 text-xs text-white/45">{description}</p>
    </div>
  );
}

function ClientAccordion({ client }: { client: AmpliaClient }) {
  const t = useTranslations("admin.amplia");

  return (
    <details className="group py-4">
      <summary className="flex cursor-pointer list-none items-center justify-between">
        <div className="flex items-center gap-4">
          {client.profilePhotoUrl ? (
            <img
              src={client.profilePhotoUrl}
              alt=""
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white/60">
              {client.displayName.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div>
            <p className="font-semibold text-white">{client.displayName}</p>
            <p className="text-xs text-white/45">
              {client.stageName || client.fullName || "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              client.type === "model"
                ? "bg-pink-500/20 text-pink-200"
                : "bg-white/10 text-white/60"
            }`}
          >
            {client.type === "model" ? t("karayModel") : t("ampliaClient")}
          </span>
          <span className="text-white/40 transition group-open:rotate-180">
            ▼
          </span>
        </div>
      </summary>

      <div className="mt-4 grid gap-4 pl-14 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-white/45">{t("fields.email")}</p>
          <p className="mt-1 text-white/80">{client.email || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-white/45">{t("fields.whatsapp")}</p>
          <p className="mt-1 text-white/80">{client.whatsapp || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-white/45">{t("fields.city")}</p>
          <p className="mt-1 text-white/80">{client.location || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-white/45">{t("fields.status")}</p>
          <p className="mt-1 capitalize text-white/80">{client.brandStatus.replace(/_/g, " ")}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 pl-14">
        <Link
          href={`/admin/socialmediamodels/models/${client.talentId}`}
          className="rounded-lg bg-pink-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-400"
        >
          {t("openProfile")}
        </Link>
      </div>
    </details>
  );
}

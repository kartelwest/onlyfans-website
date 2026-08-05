"use client";

import { useLocale, useTranslations } from "next-intl";

import { toLocale, type Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/models/formatDateTime";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import DeleteRepresentativeButton from "@/components/admin/DeleteRepresentativeButton";
import RepresentativeModelsDropdown, {
  type RepresentativeModel,
} from "@/components/admin/RepresentativeModelsDropdown";

import {
  updateRepresentativeStatus,
  viewAsRepresentative,
} from "./actions";

type RepresentativeRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  status: string | null;
  active: boolean | null;
  last_login_at: string | null;
  status_changed_at: string | null;
  created_at: string | null;
};

type RepresentativesClientProps = {
  initialStatusFilter: "all" | "ativa" | "inativa" | "arquivada";
  representatives: RepresentativeRow[];
  modelsByRepresentative: Map<string, RepresentativeModel[]>;
  isOwner: boolean;
};

/** Database status values; the words come from `enums.representativeStatus`. */
const STATUS_OPTIONS = ["all", "ativa", "inativa", "arquivada"] as const;

function formatDate(value: string | null, locale: Locale) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return formatDateTime(date, locale);
}

export default function RepresentativesClient({
  initialStatusFilter,
  representatives,
  modelsByRepresentative,
  isOwner,
}: RepresentativesClientProps) {
  const t = useTranslations("admin.representatives.list");
  const tStatus = useTranslations("enums.representativeStatus");
  const tCommon = useTranslations("common.states");
  const locale = toLocale(useLocale());

  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  // Kept with its own success flag rather than sniffing the sentence for
  // "sucesso"/"excluído" — that test fails the moment the server answers in
  // another language, turning every success red.
  const [result, setResult] = useState<{ text: string; ok: boolean } | null>(
    null,
  );

  const filtered =
    statusFilter === "all"
      ? representatives
      : representatives.filter((rep) => rep.status === statusFilter);

  async function handleStatusChange(representativeId: string, status: string) {
    const formData = new FormData();
    formData.set("representativeId", representativeId);
    formData.set("status", status);

    startTransition(async () => {
      const outcome = await updateRepresentativeStatus(null, formData);

      setResult({ text: outcome.message, ok: outcome.success });

      if (outcome.success) {
        router.refresh();
      }
    });
  }

  async function handleViewAs(representativeId: string) {
    startTransition(async () => {
      await viewAsRepresentative(representativeId);
    });
  }

  return (
    <>
      {result && (
        <div
          className={`mb-6 rounded-2xl border px-5 py-4 text-sm ${
            result.ok
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
              : "border-red-400/30 bg-red-500/10 text-red-200"
          }`}
        >
          {result.text}
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setStatusFilter(option);
              setResult(null);
            }}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              statusFilter === option
                ? "border-pink-400/50 bg-pink-500/20 text-pink-200"
                : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
            }`}
          >
            {option === "all" ? tCommon("all") : tStatus(option)}
          </button>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-wider text-white/50">
              <tr>
                <th className="px-5 py-4 font-semibold">{t("name")}</th>
                <th className="px-5 py-4 font-semibold">{t("contact")}</th>
                <th className="px-5 py-4 font-semibold">{t("status")}</th>
                <th className="px-5 py-4 font-semibold">{t("models")}</th>
                <th className="px-5 py-4 font-semibold">{t("lastAccess")}</th>
                <th className="px-5 py-4 font-semibold">{t("since")}</th>
                <th className="px-5 py-4 font-semibold">{t("actions")}</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/5">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-white/40"
                  >
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                filtered.map((rep) => (
                  <tr
                    key={rep.id}
                    className="transition hover:bg-white/[0.025]"
                  >
                    <td className="px-5 py-4 align-top">
                      <Link
                        href={`/admin/representatives/${rep.id}`}
                        className="font-semibold text-white/90 transition hover:text-pink-300"
                      >
                        {rep.full_name || t("noName")}
                      </Link>
                    </td>

                    <td className="px-5 py-4 align-top">
                      <p className="text-white/70">{rep.email || "—"}</p>
                      <p className="mt-1 text-white/50">{rep.phone || "—"}</p>
                    </td>

                    <td className="px-5 py-4 align-top">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                          rep.status === "ativa"
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                            : rep.status === "inativa"
                              ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                              : "border-white/15 bg-white/5 text-white/50"
                        }`}
                      >
                        {rep.status === "ativa" ||
                        rep.status === "inativa" ||
                        rep.status === "arquivada"
                          ? tStatus(rep.status)
                          : (rep.status ?? "—")}
                      </span>
                    </td>

                    <td className="px-5 py-4 align-top text-white/70">
                      <RepresentativeModelsDropdown
                        representativeId={rep.id}
                        models={modelsByRepresentative.get(rep.id) ?? []}
                      />
                    </td>

                    <td className="px-5 py-4 align-top text-white/50">
                      {formatDate(rep.last_login_at, locale)}
                    </td>

                    <td className="px-5 py-4 align-top text-white/50">
                      {formatDate(rep.created_at, locale)}
                    </td>

                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-wrap gap-2">
                        {rep.status !== "ativa" && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleStatusChange(rep.id, "ativa")}
                            className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-40"
                          >
                            {t("activate")}
                          </button>
                        )}

                        {rep.status !== "inativa" && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleStatusChange(rep.id, "inativa")}
                            className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-40"
                          >
                            {t("deactivate")}
                          </button>
                        )}

                        {rep.status !== "arquivada" && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleStatusChange(rep.id, "arquivada")}
                            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-40"
                          >
                            {t("archive")}
                          </button>
                        )}

                        {rep.status === "ativa" && (
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleViewAs(rep.id)}
                            className="rounded-lg border border-pink-400/30 bg-pink-500/10 px-3 py-2 text-xs font-bold text-pink-200 transition hover:bg-pink-500/20 disabled:opacity-40"
                          >
                            {t("viewAsThem")}
                          </button>
                        )}

                        <Link
                          href={`/admin/representatives/${rep.id}`}
                          className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-white transition hover:bg-white/10"
                        >
                          {t("openProfile")}
                        </Link>

                        {isOwner && (
                          <DeleteRepresentativeButton
                            representativeId={rep.id}
                            representativeName={rep.full_name ?? ""}
                            assignedModelCount={
                              modelsByRepresentative.get(rep.id)?.length ?? 0
                            }
                            profileHref={`/admin/representatives/${rep.id}`}
                            className="rounded-lg border border-red-600/40 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </>
  );
}

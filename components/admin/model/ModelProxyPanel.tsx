"use client";

import { useTranslations } from "next-intl";

import { useMemo, useState } from "react";

import {
  countryCodeToFlag,
  getCountryName,
  listCountries,
} from "@/lib/countries";
import {
  isValidProxyIp,
} from "@/lib/models/proxyDetails";

import type { ModelProxyDetails, ProxyCompany } from "@/types/model";

type ModelProxyPanelProps = {
  modelId: string;
  proxyDetails: ModelProxyDetails;
  canEdit: boolean;
};

// PROXY / COMPANY NAME / COUNTRY sit next to the model name and are editable
// by the owner only — administrators see the same values read-only. The
// database enforces the same rule (set_model_proxy_details checks is_owner()).
export default function ModelProxyPanel({
  modelId,
  proxyDetails,
  canEdit,
}: ModelProxyPanelProps) {
  const t = useTranslations("admin.proxy");
  const tCommon = useTranslations("common.actions");
  const tState = useTranslations("common.states");
  const tErrors = useTranslations("errors");
  const tCompany = useTranslations("enums.proxyCompany");

  const [details, setDetails] = useState(proxyDetails);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [proxyIp, setProxyIp] = useState(proxyDetails.proxyIp ?? "");
  const [company, setCompany] = useState<ProxyCompany | "">(
    proxyDetails.proxyCompany ?? "",
  );
  const [companyOther, setCompanyOther] = useState(
    proxyDetails.proxyCompanyOther ?? "",
  );
  const [country, setCountry] = useState(proxyDetails.proxyCountry ?? "");

  const countries = useMemo(() => listCountries(), []);

  // "other" shows the free-text name the admin typed — that is their words, not
  // ours, so it is never translated. A known provider shows its catalog label.
  const companyValue =
    details.proxyCompany === "other"
      ? details.proxyCompanyOther
      : details.proxyCompany
        ? tCompany(details.proxyCompany)
        : null;

  function startEditing() {
    setProxyIp(details.proxyIp ?? "");
    setCompany(details.proxyCompany ?? "");
    setCompanyOther(details.proxyCompanyOther ?? "");
    setCountry(details.proxyCountry ?? "");
    setSaveError(null);
    setIsEditing(true);
  }

  async function handleSave() {
    const payload = {
      modelId,
      proxyIp: proxyIp.trim() || null,
      proxyCompany: company || null,
      proxyCompanyOther:
        company === "other" ? companyOther.trim() || null : null,
      proxyCountry: country || null,
    };

    if (payload.proxyIp && !isValidProxyIp(payload.proxyIp)) {
      setSaveError(t("invalidIp"));
      return;
    }

    if (payload.proxyCompany === "other" && !payload.proxyCompanyOther) {
      setSaveError(t("companyRequired"));
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch("/api/models/proxy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? tErrors("saveFailed"));
      }

      setDetails({
        proxyIp: payload.proxyIp,
        proxyCompany: payload.proxyCompany,
        proxyCompanyOther: payload.proxyCompanyOther,
        proxyCountry: payload.proxyCountry,
      });

      setIsEditing(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : tErrors("saveFailed"),
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-200">
          {t("title")}
        </p>

        {canEdit && !isEditing && (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/10"
          >
            {tCommon("edit")}
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
              {t("proxy")}
            </span>

            <input
              type="text"
              value={proxyIp}
              disabled={isSaving}
              placeholder="48.45.165.230"
              onChange={(event) => setProxyIp(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-pink-300 disabled:opacity-50"
            />
          </label>

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
              {t("companyName")}
            </span>

            <select
              value={company}
              disabled={isSaving}
              onChange={(event) =>
                setCompany(event.target.value as ProxyCompany | "")
              }
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-pink-300 disabled:opacity-50"
            >
              <option value="">{tState("notInformed")}</option>
              <option value="proxy_empire">
                {tCompany("proxy_empire")}
              </option>

              <option value="other">{tCompany("other")}</option>
            </select>
          </label>

          {company === "other" && (
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                {t("companyNameOther")}
              </span>

              <input
                type="text"
                value={companyOther}
                disabled={isSaving}
                placeholder={t("companyPlaceholder")}
                onChange={(event) => setCompanyOther(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-pink-300 disabled:opacity-50"
              />
            </label>
          )}

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
              {t("country")}
            </span>

            <select
              value={country}
              disabled={isSaving}
              onChange={(event) => setCountry(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-pink-300 disabled:opacity-50"
            >
              <option value="">{tState("notInformed")}</option>

              {countries.map((option) => (
                <option key={option.code} value={option.code}>
                  {countryCodeToFlag(option.code)} {option.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave()}
              className="rounded-lg bg-pink-300 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#321725] transition hover:bg-pink-200 disabled:opacity-40"
            >
              {isSaving ? tCommon("saving") : tCommon("save")}
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                setIsEditing(false);
                setSaveError(null);
              }}
              className="rounded-lg border border-white/15 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-white/65 transition hover:bg-white/5 disabled:opacity-40"
            >
              {tCommon("cancel")}
            </button>
          </div>

          {saveError && (
            <p className="text-xs leading-5 text-red-300">{saveError}</p>
          )}
        </div>
      ) : (
        <dl className="mt-3 space-y-2">
          <ProxyValue label={t("proxy")} value={details.proxyIp} />

          <ProxyValue label={t("companyName")} value={companyValue} />

          <ProxyValue
            label={t("country")}
            value={
              details.proxyCountry
                ? `${countryCodeToFlag(details.proxyCountry)} ${getCountryName(details.proxyCountry)}`
                : null
            }
          />
        </dl>
      )}
    </div>
  );
}

function ProxyValue({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const tState = useTranslations("common.states");

  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </dt>

      <dd className="text-sm font-semibold text-white">
        {value || tState("notInformed")}
      </dd>
    </div>
  );
}

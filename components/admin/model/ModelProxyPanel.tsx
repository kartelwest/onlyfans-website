"use client";

import { useMemo, useState } from "react";

import { getCountryName, listCountries } from "@/lib/countries";
import {
  PROXY_COMPANY_LABELS,
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

  const companyValue =
    details.proxyCompany === "other"
      ? details.proxyCompanyOther
      : details.proxyCompany
        ? PROXY_COMPANY_LABELS[details.proxyCompany]
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
      setSaveError("Informe um IP válido, por exemplo 48.45.165.230.");
      return;
    }

    if (payload.proxyCompany === "other" && !payload.proxyCompanyOther) {
      setSaveError("Informe o nome da empresa do proxy.");
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
        throw new Error(data.error ?? "Não foi possível salvar.");
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
        error instanceof Error ? error.message : "Não foi possível salvar.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink-200">
          Infraestrutura
        </p>

        {canEdit && !isEditing && (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/70 transition hover:bg-white/10"
          >
            Editar
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
              Proxy
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
              Company name
            </span>

            <select
              value={company}
              disabled={isSaving}
              onChange={(event) =>
                setCompany(event.target.value as ProxyCompany | "")
              }
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-pink-300 disabled:opacity-50"
            >
              <option value="">Não informado</option>
              <option value="proxy_empire">
                {PROXY_COMPANY_LABELS.proxy_empire}
              </option>

              <option value="other">{PROXY_COMPANY_LABELS.other}</option>
            </select>
          </label>

          {company === "other" && (
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
                Nome da empresa
              </span>

              <input
                type="text"
                value={companyOther}
                disabled={isSaving}
                placeholder="Nome da empresa do proxy"
                onChange={(event) => setCompanyOther(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-pink-300 disabled:opacity-50"
              />
            </label>
          )}

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
              Country
            </span>

            <select
              value={country}
              disabled={isSaving}
              onChange={(event) => setCountry(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition focus:border-pink-300 disabled:opacity-50"
            >
              <option value="">Não informado</option>

              {countries.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
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
              {isSaving ? "Salvando..." : "Salvar"}
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
              Cancelar
            </button>
          </div>

          {saveError && (
            <p className="text-xs leading-5 text-red-300">{saveError}</p>
          )}
        </div>
      ) : (
        <dl className="mt-3 space-y-2">
          <ProxyValue label="Proxy" value={details.proxyIp} />

          <ProxyValue label="Company name" value={companyValue} />

          <ProxyValue
            label="Country"
            value={getCountryName(details.proxyCountry)}
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
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </dt>

      <dd className="text-sm font-semibold text-white">
        {value || "Não informado"}
      </dd>
    </div>
  );
}

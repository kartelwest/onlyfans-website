"use client";

import { useTranslations } from "next-intl";

import { useEffect, useState } from "react";

import EditableTextField from "@/components/admin/model/EditableTextField";

import type { Model } from "@/types/model";

type SocialAccountsSectionProps = {
  model: Model;
  onModelUpdate: (updatedModel: Model) => void;
};

type MarketingResponse = {
  instagramMarketing?: string | null;
  twitterMarketing?: string | null;
  error?: string;
};

// Section 6 — Social Accounts. Owner/administrator only (OverviewTab only
// renders for those roles to begin with, but this section is doubly
// enforced: instagram_marketing/twitter_marketing aren't even selectable by
// the `authenticated` Postgres role for anyone but staff — see
// get_model_marketing/set_model_marketing and the models_column_select_allowlist
// migration. A rep or model never reaches this component at all; they get
// the separate read-only Model Dashboard instead.
export default function SocialAccountsSection({
  model,
  onModelUpdate,
}: SocialAccountsSectionProps) {
  const t = useTranslations("admin.social");
  const tCommon = useTranslations("common.actions");
  const tState = useTranslations("common.states");
  const tErrors = useTranslations("errors");

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [instagramMarketing, setInstagramMarketing] = useState("");
  const [twitterMarketing, setTwitterMarketing] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadMarketing() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await fetch(
          `/api/models/marketing?modelId=${encodeURIComponent(model.id)}`,
        );

        const data = (await response.json()) as MarketingResponse;

        if (!response.ok) {
          throw new Error(data.error ?? tErrors("loadFailed"));
        }

        if (!cancelled) {
          setInstagramMarketing(data.instagramMarketing ?? "");
          setTwitterMarketing(data.twitterMarketing ?? "");
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : t("loadFailed"),
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadMarketing();

    return () => {
      cancelled = true;
    };
  }, [model.id]);

  async function updateOwnField(
    field: "instagram" | "twitter",
    value: string,
  ) {
    const response = await fetch("/api/models/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelId: model.id, field, value }),
    });

    const data = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    if (!response.ok || !data.success) {
      throw new Error(data.error ?? tErrors("saveFailed"));
    }

    onModelUpdate({ ...model, [field]: value });
  }

  async function saveMarketing(
    field: "instagramMarketing" | "twitterMarketing",
    value: string,
  ) {
    const nextInstagram =
      field === "instagramMarketing" ? value : instagramMarketing;
    const nextTwitter =
      field === "twitterMarketing" ? value : twitterMarketing;

    const response = await fetch("/api/models/marketing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelId: model.id,
        instagramMarketing: nextInstagram,
        twitterMarketing: nextTwitter,
      }),
    });

    const data = (await response.json()) as {
      success?: boolean;
      error?: string;
    };

    if (!response.ok || !data.success) {
      throw new Error(data.error ?? tErrors("saveFailed"));
    }

    setInstagramMarketing(nextInstagram);
    setTwitterMarketing(nextTwitter);
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-[#111115] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-pink-300">
            {t("restricted")}
          </p>
          <h3 className="mt-2 text-xl font-bold">{t("title")}</h3>
          <p className="mt-1 text-sm text-white/45">
            {t("neverVisible")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsEditing((current) => !current)}
          className={
            isEditing
              ? "rounded-xl border border-white/15 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/5"
              : "rounded-xl bg-pink-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#321725] transition hover:bg-pink-200"
          }
        >
          {isEditing ? t("finishEditing") : tCommon("edit")}
        </button>
      </div>

      {loadError && (
        <p className="mt-4 text-sm text-red-300">{loadError}</p>
      )}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {isEditing ? (
          <>
            <EditableTextField
              label="Instagram"
              value={model.instagram}
              placeholder={t("handlePlaceholder")}
              onSave={(value) => updateOwnField("instagram", value)}
            />
            <EditableTextField
              label="X / Twitter"
              value={model.twitter}
              placeholder={t("handlePlaceholder")}
              onSave={(value) => updateOwnField("twitter", value)}
            />
            <EditableTextField
              label={t("instagramMarketing")}
              value={instagramMarketing}
              placeholder={t("handlePlaceholder")}
              disabled={isLoading}
              onSave={(value) => saveMarketing("instagramMarketing", value)}
            />
            <EditableTextField
              label={t("twitterMarketing")}
              value={twitterMarketing}
              placeholder={t("handlePlaceholder")}
              disabled={isLoading}
              onSave={(value) => saveMarketing("twitterMarketing", value)}
            />
          </>
        ) : (
          <>
            <SocialInfo label="Instagram" value={model.instagram} />
            <SocialInfo label="X / Twitter" value={model.twitter} />
            <SocialInfo
              label={t("instagramMarketing")}
              value={isLoading ? tState("loading") : instagramMarketing}
            />
            <SocialInfo
              label={t("twitterMarketing")}
              value={isLoading ? tState("loading") : twitterMarketing}
            />
          </>
        )}
      </div>
    </section>
  );
}

function SocialInfo({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  const tState = useTranslations("common.states");

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/45">
        {label}
      </p>
      <p className="mt-3 text-sm text-white">
        {value || tState("notInformed")}
      </p>
    </div>
  );
}

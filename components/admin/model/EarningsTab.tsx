"use client";

import { useTranslations } from "next-intl";
import LedgerPanel from "@/components/admin/model/LedgerPanel";
import MonthlyEarningsPanel from "@/components/admin/model/MonthlyEarningsPanel";

import type { Model } from "@/types/model";

type EarningsTabProps = {
  model: Model;
};

export default function EarningsTab({ model }: EarningsTabProps) {
  const t = useTranslations("admin.ledger");

  return (
    <div className="space-y-8">
      <MonthlyEarningsPanel modelId={model.id} />

      {model.expensesEnabled ? (
        <LedgerPanel modelId={model.id} />
      ) : (
        <section className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-6">
          <h3 className="text-lg font-bold text-white/80">{t("title")}</h3>

          <p className="mt-2 max-w-2xl text-sm text-white/45">
            {t("disabledHint")}
          </p>
        </section>
      )}
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";

import { useMoney } from "@/lib/i18n/money";
import { BRL } from "@/lib/money/currency";

import { useEffect, useState } from "react";
import type { ManagementRole } from "@/types/model";

type ModelPayment = {
  id: string;
  pix_key: string | null;
  pix_type: string | null;
  bank_name: string | null;
  bank_account: string | null;
  bank_agency: string | null;
  account_holder_name: string | null;
  account_holder_cpf: string | null;
  payment_frequency: string | null;
  model_percentage: number;
  agency_percentage: number;
  marketing_percentage: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type EarningsReport = {
  id: string;
  platform: string | null;
  period: string | null;
  grossRevenue: number;
  modelShare: number;
  agencyShare: number;
  marketingShare: number;
  reportDate: string | null;
  visibleToModel: boolean;
  adminNote: string | null;
  imageUrl: string | null;
  createdAt: string;
};

type PaymentsTabProps = {
  modelId: string;
  currentUserRole: ManagementRole;
};

export default function PaymentsTab({
  modelId,
}: PaymentsTabProps) {
  const t = useTranslations("admin.payments");
  const tState = useTranslations("common.states");
  const tErrors = useTranslations("errors");
  const money = useMoney();

  const notInformed = tState("notInformed");

  const [payment, setPayment] = useState<ModelPayment | null>(null);
  const [earnings, setEarnings] = useState<EarningsReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        const [paymentRes, earningsRes] = await Promise.all([
          fetch(`/api/models/payments?modelId=${modelId}`),
          fetch(`/api/models/earnings?modelId=${modelId}`),
        ]);

        if (!paymentRes.ok) {
          throw new Error(t("loadPaymentFailed"));
        }

        if (!earningsRes.ok) {
          throw new Error(t("loadEarningsFailed"));
        }

        const paymentData = await paymentRes.json();
        const earningsData = await earningsRes.json();

        setPayment(paymentData.payment);
        setEarnings(earningsData.reports || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : tErrors("loadFailed")
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [modelId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-white/55">{tState("loading")}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
        <h3 className="mb-4 text-lg font-bold text-pink-200">
          {t("paymentDetails")}
        </h3>

        {payment ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoItem
              label={t("fields.pixKey")}
              value={payment.pix_key || notInformed}
            />
            <InfoItem
              label={t("fields.pixType")}
              value={payment.pix_type || notInformed}
            />
            <InfoItem
              label={t("fields.bank")}
              value={payment.bank_name || notInformed}
            />
            <InfoItem
              label={t("fields.branch")}
              value={payment.bank_agency || notInformed}
            />
            <InfoItem
              label={t("fields.account")}
              value={payment.bank_account || notInformed}
            />
            <InfoItem
              label={t("fields.holder")}
              value={payment.account_holder_name || notInformed}
            />
            <InfoItem
              label={t("fields.holderCpf")}
              value={payment.account_holder_cpf || notInformed}
            />
            <InfoItem
              label={t("fields.frequency")}
              value={payment.payment_frequency || notInformed}
            />
            <InfoItem
              label={t("fields.pctModel")}
              value={`${payment.model_percentage}%`}
            />
            <InfoItem
              label={t("fields.pctAgency")}
              value={`${payment.agency_percentage}%`}
            />
            <InfoItem
              label={t("fields.pctMarketing")}
              value={`${payment.marketing_percentage}%`}
            />
            <InfoItem
              label={t("fields.status")}
              value={payment.status}
            />
          </div>
        ) : (
          <p className="text-sm text-white/55">
            {t("noPaymentDetails")}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
        <h3 className="mb-4 text-lg font-bold text-pink-200">
          {t("earningsReports")}
        </h3>

        {earnings.length === 0 ? (
          <p className="text-sm text-white/55">
            {t("noEarnings")}
          </p>
        ) : (
          <div className="space-y-4">
            {earnings.map((report) => (
              <div
                key={report.id}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {report.platform || t("noPlatform")}
                    </p>
                    <p className="text-xs text-white/55">
                      {report.period || t("noPeriod")}
                    </p>
                  </div>

                  <div className="flex gap-4 text-right">
                    <div>
                      <p className="text-xs text-white/55">
                        {t("total")}
                      </p>
                      <p className="text-sm font-bold text-pink-300">
                        {money.format(report.grossRevenue, BRL)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/55">
                        {t("model")}
                      </p>
                      <p className="text-sm font-bold text-green-300">
                        {money.format(report.modelShare, BRL)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/55">
                        {t("agency")}
                      </p>
                      <p className="text-sm font-bold text-blue-300">
                        {money.format(report.agencyShare, BRL)}
                      </p>
                    </div>
                  </div>
                </div>

                {report.imageUrl && (
                  <div className="mt-4">
                    <a
                      href={report.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-pink-300 hover:text-pink-200"
                    >
                      {t("viewReceipt")}
                    </a>
                  </div>
                )}

                {report.adminNote && (
                  <p className="mt-3 text-xs text-white/55">
                    {t("note", { note: report.adminNote })}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-white/90">
        {value}
      </p>
    </div>
  );
}

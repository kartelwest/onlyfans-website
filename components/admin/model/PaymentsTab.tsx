"use client";

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
          throw new Error("Erro ao carregar dados de pagamento.");
        }

        if (!earningsRes.ok) {
          throw new Error("Erro ao carregar relatórios de ganhos.");
        }

        const paymentData = await paymentRes.json();
        const earningsData = await earningsRes.json();

        setPayment(paymentData.payment);
        setEarnings(earningsData.reports || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar dados."
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
        <p className="text-sm text-white/55">Carregando...</p>
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
          Dados de Pagamento
        </h3>

        {payment ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <InfoItem
              label="Chave PIX"
              value={payment.pix_key || "Não informado"}
            />
            <InfoItem
              label="Tipo de PIX"
              value={payment.pix_type || "Não informado"}
            />
            <InfoItem
              label="Banco"
              value={payment.bank_name || "Não informado"}
            />
            <InfoItem
              label="Agência"
              value={payment.bank_agency || "Não informado"}
            />
            <InfoItem
              label="Conta"
              value={payment.bank_account || "Não informado"}
            />
            <InfoItem
              label="Titular"
              value={payment.account_holder_name || "Não informado"}
            />
            <InfoItem
              label="CPF do titular"
              value={payment.account_holder_cpf || "Não informado"}
            />
            <InfoItem
              label="Frequência"
              value={payment.payment_frequency || "Não informado"}
            />
            <InfoItem
              label="% Modelo"
              value={`${payment.model_percentage}%`}
            />
            <InfoItem
              label="% Agência"
              value={`${payment.agency_percentage}%`}
            />
            <InfoItem
              label="% Marketing"
              value={`${payment.marketing_percentage}%`}
            />
            <InfoItem
              label="Status"
              value={payment.status}
            />
          </div>
        ) : (
          <p className="text-sm text-white/55">
            Dados de pagamento não configurados.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
        <h3 className="mb-4 text-lg font-bold text-pink-200">
          Relatórios de Ganhos
        </h3>

        {earnings.length === 0 ? (
          <p className="text-sm text-white/55">
            Nenhum relatório de ganhos encontrado.
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
                      {report.platform || "Sem plataforma"}
                    </p>
                    <p className="text-xs text-white/55">
                      {report.period || "Sem período"}
                    </p>
                  </div>

                  <div className="flex gap-4 text-right">
                    <div>
                      <p className="text-xs text-white/55">Total</p>
                      <p className="text-sm font-bold text-pink-300">
                        R$ {report.grossRevenue.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/55">Modelo</p>
                      <p className="text-sm font-bold text-green-300">
                        R$ {report.modelShare.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/55">Agência</p>
                      <p className="text-sm font-bold text-blue-300">
                        R$ {report.agencyShare.toFixed(2)}
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
                      Ver comprovante
                    </a>
                  </div>
                )}

                {report.adminNote && (
                  <p className="mt-3 text-xs text-white/55">
                    Nota: {report.adminNote}
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

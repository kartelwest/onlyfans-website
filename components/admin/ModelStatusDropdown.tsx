"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { ModelStatus } from "@/types/model";

type ModelStatusDropdownProps = {
    modelId: string;
    status: ModelStatus;
};

/**
 * Colour only. The words come from `enums.modelStatus`, which is also what the
 * filters, the pageview badges and the representative screens read — one status
 * must not be "Ativa" in one table and "Ativo" in the next.
 */
const STATUS_CLASS: Record<ModelStatus, string> = {
    active: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
    inactive: "border-white/15 bg-white/5 text-white/60",
    candidate: "border-yellow-400/40 bg-yellow-500/15 text-yellow-300",
    denied: "border-red-400/40 bg-red-500/15 text-red-300",
};

const STATUS_ORDER: ModelStatus[] = ["active", "inactive", "candidate", "denied"];

export default function ModelStatusDropdown({
    modelId,
    status,
}: ModelStatusDropdownProps) {
    const t = useTranslations("enums.modelStatus");
    const tErrors = useTranslations("errors");
    const router = useRouter();
    const [currentStatus, setCurrentStatus] = useState<ModelStatus>(status);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");
    const [warning, setWarning] = useState("");

    async function handleChange(nextStatus: ModelStatus) {
        if (nextStatus === currentStatus || isSaving) {
            return;
        }

        const previousStatus = currentStatus;
        setCurrentStatus(nextStatus);
        setError("");
        setWarning("");
        setIsSaving(true);

        try {
            const response = await fetch("/api/models/status", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    modelId,
                    status: nextStatus,
                }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || tErrors("saveFailed"));
            }

            // Activating a model who has no portal login still succeeds — it
            // just does not grant her anything to log in with. Say so, instead
            // of leaving the admin to find out when she cannot get in.
            if (typeof result.warning === "string" && result.warning) {
                setWarning(result.warning);
            }

            router.refresh();
        } catch (err) {
            setCurrentStatus(previousStatus);
            setError(
                err instanceof Error ? err.message : tErrors("generic"),
            );
        } finally {
            setIsSaving(false);
        }
    }

    const statusClass = STATUS_CLASS[currentStatus];

    return (
        <div className="flex flex-col gap-1">
            <select
                value={currentStatus}
                disabled={isSaving}
                onChange={(event) =>
                    void handleChange(event.target.value as ModelStatus)
                }
                className={`rounded-full border px-3 py-1.5 text-xs font-bold outline-none transition disabled:opacity-50 ${statusClass}`}
            >
                {STATUS_ORDER.map((value) => (
                    <option
                        key={value}
                        value={value}
                        className="bg-[#111115] text-white"
                    >
                        {t(value)}
                    </option>
                ))}
            </select>

            {error && <p className="text-xs text-red-400">{error}</p>}

            {warning && (
                <p className="max-w-[16rem] text-xs leading-5 text-amber-300">
                    {warning}
                </p>
            )}
        </div>
    );
}

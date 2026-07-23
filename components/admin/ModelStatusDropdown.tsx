"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { ModelStatus } from "@/types/model";

type ModelStatusDropdownProps = {
    modelId: string;
    status: ModelStatus;
};

const statusConfig: Record<
    ModelStatus,
    { label: string; className: string }
> = {
    active: {
        label: "Ativo",
        className:
            "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
    },
    inactive: {
        label: "Inativo",
        className: "border-white/15 bg-white/5 text-white/60",
    },
    candidate: {
        label: "Candidata",
        className:
            "border-yellow-400/40 bg-yellow-500/15 text-yellow-300",
    },
    denied: {
        label: "Negada",
        className: "border-red-400/40 bg-red-500/15 text-red-300",
    },
};

export default function ModelStatusDropdown({
    modelId,
    status,
}: ModelStatusDropdownProps) {
    const router = useRouter();
    const [currentStatus, setCurrentStatus] = useState<ModelStatus>(status);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    async function handleChange(nextStatus: ModelStatus) {
        if (nextStatus === currentStatus || isSaving) {
            return;
        }

        const previousStatus = currentStatus;
        setCurrentStatus(nextStatus);
        setError("");
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
                throw new Error(
                    result.error || "Não foi possível alterar o status.",
                );
            }

            router.refresh();
        } catch (err) {
            setCurrentStatus(previousStatus);
            setError(
                err instanceof Error
                    ? err.message
                    : "Ocorreu um erro inesperado.",
            );
        } finally {
            setIsSaving(false);
        }
    }

    const config = statusConfig[currentStatus];

    return (
        <div className="flex flex-col gap-1">
            <select
                value={currentStatus}
                disabled={isSaving}
                onChange={(event) =>
                    void handleChange(event.target.value as ModelStatus)
                }
                className={`rounded-full border px-3 py-1.5 text-xs font-bold outline-none transition disabled:opacity-50 ${config.className}`}
            >
                {Object.entries(statusConfig).map(([value, cfg]) => (
                    <option
                        key={value}
                        value={value}
                        className="bg-[#111115] text-white"
                    >
                        {cfg.label}
                    </option>
                ))}
            </select>

            {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
    );
}

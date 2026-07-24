import Link from "next/link";

export default function ViewAsBanner({
  label,
  backHref,
}: {
  label: string;
  backHref: string;
}) {
  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-[#4b2438] px-6 py-3 text-white shadow-md">
      <p className="text-sm font-semibold">
        Modo de visualização (Admin) — {label}
      </p>

      <Link
        href={backHref}
        className="rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/20"
      >
        ← Voltar ao painel
      </Link>
    </div>
  );
}

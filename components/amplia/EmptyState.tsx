export default function EmptyState({
  title,
  description,
  note,
}: {
  title: string;
  description: string;
  note?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-[#111115] px-8 py-16 text-center">
      <p className="text-lg font-bold text-white">{title}</p>

      <p className="mx-auto mt-2 max-w-md text-sm text-white/50">
        {description}
      </p>

      {note && (
        <p className="mx-auto mt-4 max-w-md text-xs font-semibold uppercase tracking-[0.1em] text-purple-300/70">
          {note}
        </p>
      )}
    </div>
  );
}

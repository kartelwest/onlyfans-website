export default function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="mb-6 flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-purple-300">
        {title}
      </p>

      <p className="max-w-2xl text-sm text-white/55">{description}</p>
    </header>
  );
}

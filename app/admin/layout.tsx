import LogoutButton from "@/components/LogoutButton";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#08080a]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0b0d]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-300">
              KARAY MODELS CRM
            </p>

            <p className="mt-1 text-sm text-white/50">
              Proprietário / Administrador
            </p>
          </div>

          <LogoutButton />
        </div>
      </header>

      {children}
    </div>
  );
}
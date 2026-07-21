export default function PortalPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f1ec]">
      <div className="rounded-3xl bg-white p-10 shadow-xl">
        <h1 className="text-4xl font-bold text-[#4b2438]">
          Portal KARRAY Models
        </h1>

        <p className="mt-4 text-[#765c68]">
          Portal criado com sucesso.
        </p>

        <p className="mt-2 text-sm text-[#765c68]">
          Em seguida iremos carregar automaticamente o painel correto
          conforme o usuário logado.
        </p>
      </div>
    </main>
  );
}
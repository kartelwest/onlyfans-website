import AdminHeader from "./AdminHeader";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#08080a]">
      <AdminHeader />
      {children}
    </div>
  );
}

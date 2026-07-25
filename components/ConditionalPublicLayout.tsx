"use client";

import { usePathname } from "next/navigation";

import ConditionalNavbar from "@/components/ConditionalNavbar";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import Footer from "@/components/Footer";

const privateRoutes = [
  "/owner",
  "/admin",
  "/administrator",
  "/representative",
  "/area-da-modelo",
  "/login",
];

export default function ConditionalPublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isPrivatePage = privateRoutes.some(
    (route) =>
      pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isPrivatePage) {
    return <>{children}</>;
  }

  return (
    <>
      <ConditionalNavbar />

      {children}

      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
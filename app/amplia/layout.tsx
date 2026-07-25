import type { ReactNode } from "react";
import { requireAmpliaAccess } from "@/lib/amplia/auth";

export const dynamic = "force-dynamic";

export default async function AmpliaRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAmpliaAccess();
  return <>{children}</>;
}

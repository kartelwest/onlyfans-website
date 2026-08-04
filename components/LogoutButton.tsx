"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_CLASS_NAME =
  "rounded-full bg-[#4b2438] px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-white transition hover:bg-[#321725] disabled:cursor-not-allowed disabled:opacity-60";

/**
 * The one sign-out path in the app. The Área da Modelo passes its own
 * className because that portal is dark-themed and mobile-first, but the
 * behaviour — signOut, then replace with /login — must stay identical
 * everywhere, so it lives here rather than being reimplemented per portal.
 */
export default function LogoutButton({
  className,
}: {
  className?: string;
} = {}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);

    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className={className ?? DEFAULT_CLASS_NAME}
    >
      {loading ? t("signingOut") : t("signOut")}
    </button>
  );
}
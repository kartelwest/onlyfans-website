"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const IDLE_TIMEOUT_MS = 3 * 60 * 1000;

const protectedRoutes = [
  "/owner",
  "/admin",
  "/administrator",
  "/representative",
  "/area-da-modelo",
  "/alterar-senha",
];

function isProtectedRoute(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }

  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export default function IdleTimeoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isProtectedRoute(pathname)) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      return;
    }

    const supabase = createClient();

    function signOutAndRedirect() {
      void supabase.auth.signOut().then(() => {
        router.replace("/login");
      });
    }

    function resetTimer() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(signOutAndRedirect, IDLE_TIMEOUT_MS);
    }

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "click",
      "scroll",
    ];

    events.forEach((event) => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    resetTimer();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      events.forEach((event) => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [pathname, router]);

  return <>{children}</>;
}

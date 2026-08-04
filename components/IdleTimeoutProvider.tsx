"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import {
  BROADCAST_CHANNEL_NAME,
  INACTIVITY_TIMEOUT_MS,
  WARNING_THRESHOLD_MS,
} from "@/lib/auth/inactivityConfig";

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

type BroadcastMessage =
  | { type: "activity"; timestamp: number }
  | { type: "logout"; timestamp: number }
  | { type: "warning-dismissed"; timestamp: number };

export default function IdleTimeoutProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("common.idleTimeout");
  const pathname = usePathname();
  const router = useRouter();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastActivityRef = useRef<number>(0);
  const [showWarning, setShowWarning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const signOutAndRedirect = useCallback(() => {
    const supabase = createClient();

    void supabase.auth.signOut().then(() => {
      if (channelRef.current) {
        channelRef.current.postMessage({
          type: "logout",
          timestamp: Date.now(),
        } satisfies BroadcastMessage);
      }

      const loginUrl = new URL("/login", window.location.origin);
      loginUrl.searchParams.set("expired", "1");
      loginUrl.searchParams.set("returnTo", pathname ?? "");
      window.location.replace(loginUrl.toString());
    });
  }, [pathname]);

  const refreshSession = useCallback(async () => {
    setRefreshing(true);

    try {
      const res = await fetch("/api/auth/refresh-session", {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        lastActivityRef.current = data.timestamp ?? Date.now();
        setShowWarning(false);

        if (channelRef.current) {
          channelRef.current.postMessage({
            type: "warning-dismissed",
            timestamp: lastActivityRef.current,
          } satisfies BroadcastMessage);
        }
      }
    } catch {
      // ignore — the backend proxy will still enforce the timeout
    } finally {
      setRefreshing(false);
    }
  }, []);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (warningRef.current) {
      clearTimeout(warningRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      signOutAndRedirect();
    }, INACTIVITY_TIMEOUT_MS);

    warningRef.current = setTimeout(() => {
      setShowWarning(true);
    }, WARNING_THRESHOLD_MS);

    if (channelRef.current) {
      channelRef.current.postMessage({
        type: "activity",
        timestamp: lastActivityRef.current,
      } satisfies BroadcastMessage);
    }
  }, [signOutAndRedirect]);

  useEffect(() => {
    if (!isProtectedRoute(pathname)) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      if (warningRef.current) {
        clearTimeout(warningRef.current);
        warningRef.current = null;
      }

      return;
    }

    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<BroadcastMessage>) => {
      const msg = event.data;

      if (msg.type === "activity") {
        lastActivityRef.current = msg.timestamp;
        setShowWarning(false);

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        if (warningRef.current) {
          clearTimeout(warningRef.current);
        }

        const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - msg.timestamp);
        timeoutRef.current = setTimeout(() => {
          signOutAndRedirect();
        }, Math.max(remaining, 0));

        const warningRemaining = WARNING_THRESHOLD_MS - (Date.now() - msg.timestamp);
        warningRef.current = setTimeout(() => {
          setShowWarning(true);
        }, Math.max(warningRemaining, 0));
      } else if (msg.type === "logout") {
        const loginUrl = new URL("/login", window.location.origin);
        loginUrl.searchParams.set("expired", "1");
        loginUrl.searchParams.set("returnTo", pathname ?? "");
        window.location.replace(loginUrl.toString());
      } else if (msg.type === "warning-dismissed") {
        lastActivityRef.current = msg.timestamp;
        setShowWarning(false);

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        if (warningRef.current) {
          clearTimeout(warningRef.current);
        }

        const remaining = INACTIVITY_TIMEOUT_MS - (Date.now() - msg.timestamp);
        timeoutRef.current = setTimeout(() => {
          signOutAndRedirect();
        }, Math.max(remaining, 0));

        const warningRemaining = WARNING_THRESHOLD_MS - (Date.now() - msg.timestamp);
        warningRef.current = setTimeout(() => {
          setShowWarning(true);
        }, Math.max(warningRemaining, 0));
      }
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "click",
      "scroll",
    ];

    let debouncedReset: ReturnType<typeof setTimeout> | null = null;

    function debouncedResetTimer() {
      if (debouncedReset) {
        clearTimeout(debouncedReset);
      }

      debouncedReset = setTimeout(() => {
        resetTimer();
      }, 500);
    }

    events.forEach((event) => {
      document.addEventListener(event, debouncedResetTimer, { passive: true });
    });

    // Kick off the timer outside the effect body to avoid a synchronous setState.
    const initialTimer = setTimeout(() => {
      resetTimer();
    }, 0);

    return () => {
      clearTimeout(initialTimer);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (warningRef.current) {
        clearTimeout(warningRef.current);
      }

      if (debouncedReset) {
        clearTimeout(debouncedReset);
      }

      events.forEach((event) => {
        document.removeEventListener(event, debouncedResetTimer);
      });

      channel.close();
      channelRef.current = null;
    };
  }, [pathname, router, resetTimer, signOutAndRedirect]);

  return (
    <>
      {children}

      {showWarning && isProtectedRoute(pathname) && (
        <div className="fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2 transform">
          <div className="flex items-center gap-4 rounded-2xl border border-amber-400/50 bg-[#1a1a1e] px-6 py-4 shadow-2xl">
            <p className="text-sm font-medium text-amber-200">
              {t("warning")}
            </p>

            <button
              type="button"
              disabled={refreshing}
              onClick={refreshSession}
              className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? t("refreshing") : t("stayConnected")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

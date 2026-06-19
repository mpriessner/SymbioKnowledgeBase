"use client";

import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

/**
 * Detects an auth failure (401/403) from a thrown query/mutation error.
 *
 * The app's fetch helpers throw plain Errors whose message embeds the HTTP
 * status (e.g. "Failed to fetch blocks: 401"). We match the status defensively
 * on a word boundary so we don't misfire on unrelated numbers in a message.
 */
function isAuthError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = (error as { status?: number }).status;
  if (status === 401 || status === 403) return true;
  return /\b(401|403)\b/.test(error.message);
}

/**
 * Handle an auth failure once: try a single Supabase session refresh; if that
 * fails (or Supabase isn't configured), bounce to /login preserving where the
 * user was so they return there after signing in. Guards against redirect
 * loops and concurrent refresh storms.
 */
function makeAuthErrorHandler() {
  let refreshing = false;

  return async (error: unknown) => {
    if (typeof window === "undefined") return;
    if (!isAuthError(error)) return;

    // Already on the login screen — nothing to recover, avoid a loop.
    if (window.location.pathname.startsWith("/login")) return;

    if (refreshing) return;
    refreshing = true;

    try {
      const supabase = createClient();
      if (supabase) {
        const { data, error: refreshError } =
          await supabase.auth.refreshSession();
        if (!refreshError && data.session) {
          // Session restored. Let the user's next interaction / refetch retry
          // against the new token rather than forcing a navigation.
          return;
        }
      }

      const callbackUrl = encodeURIComponent(
        window.location.pathname + window.location.search
      );
      window.location.assign(`/login?callbackUrl=${callbackUrl}`);
    } finally {
      // Reset shortly after so a later, genuinely-new auth failure can recover.
      setTimeout(() => {
        refreshing = false;
      }, 2000);
    }
  };
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const handleAuthError = makeAuthErrorHandler();
    return new QueryClient({
      queryCache: new QueryCache({
        onError: (error) => {
          void handleAuthError(error);
        },
      }),
      mutationCache: new MutationCache({
        onError: (error) => {
          void handleAuthError(error);
        },
      }),
      defaultOptions: {
        queries: {
          staleTime: 10_000,
          refetchOnWindowFocus: false,
        },
      },
    });
  });

  return (
    <SupabaseProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SupabaseProvider>
  );
}

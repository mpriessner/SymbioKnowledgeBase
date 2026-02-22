import { useEffect } from "react";
import { useSupabaseClient } from "@/components/providers/SupabaseProvider";

/**
 * Proactively refreshes the Supabase session token before expiration.
 * Supabase tokens expire after 1 hour; this refreshes every 45 minutes.
 *
 * Usage: call once in a top-level provider or layout component.
 */
export function useAuthRefresh() {
  const supabase = useSupabaseClient();

  useEffect(() => {
    const interval = setInterval(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.refreshSession();
      }
    }, 45 * 60 * 1000); // 45 minutes

    return () => clearInterval(interval);
  }, [supabase]);
}

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient, User } from "@supabase/supabase-js";

interface SupabaseContextType {
  supabase: SupabaseClient | null;
  user: User | null;
  isLoading: boolean;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(
  undefined
);

// Mock user for local dev without Supabase
const DEV_USER = {
  id: "dev-user",
  email: "dev@localhost",
  app_metadata: {},
  user_metadata: { name: "Dev User" },
  aud: "authenticated",
  created_at: new Date().toISOString(),
} as unknown as User;

// Compute initial state once at module level to avoid repeated createClient calls
// This is safe because createClient returns null or a singleton
const initialClient = createClient();
const hasSupabase = initialClient !== null;

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  // Use module-level computed values for initial state
  // This eliminates setState-in-useEffect and avoids multiple createClient calls
  const [supabase] = useState<SupabaseClient | null>(() => initialClient);
  const [user, setUser] = useState<User | null>(() => hasSupabase ? null : DEV_USER);
  const [isLoading, setIsLoading] = useState(() => hasSupabase);

  useEffect(() => {
    // Skip if Supabase is not configured - DEV_USER already set via lazy init
    if (!supabase) return;

    // Get initial user
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // Proactive token refresh: refresh session every 45 minutes (tokens expire in 1 hour)
  useEffect(() => {
    if (!supabase) return;

    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.auth.refreshSession();
      }
    }, 45 * 60 * 1000);

    return () => clearInterval(interval);
  }, [supabase]);

  return (
    <SupabaseContext.Provider value={{ supabase, user, isLoading }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabaseClient(): SupabaseClient | null {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useSupabaseClient must be used within SupabaseProvider");
  }
  return context.supabase;
}

export function useUser(): User | null {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useUser must be used within SupabaseProvider");
  }
  return context.user;
}

export function useAuthLoading(): boolean {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useAuthLoading must be used within SupabaseProvider");
  }
  return context.isLoading;
}

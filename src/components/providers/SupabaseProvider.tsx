"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient, User } from "@supabase/supabase-js";

interface SupabaseContextType {
  supabase: SupabaseClient;
  user: User | null;
  isLoading: boolean;
}

const SupabaseContext = createContext<SupabaseContextType | undefined>(
  undefined
);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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

  return (
    <SupabaseContext.Provider value={{ supabase, user, isLoading }}>
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabaseClient(): SupabaseClient {
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

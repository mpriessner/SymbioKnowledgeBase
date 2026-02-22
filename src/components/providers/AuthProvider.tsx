"use client";

import { SupabaseProvider } from "@/components/providers/SupabaseProvider";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SupabaseProvider>{children}</SupabaseProvider>;
}

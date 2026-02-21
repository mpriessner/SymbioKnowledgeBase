import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-secondary)]">
      <div className="w-full max-w-sm rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-[var(--text-primary)]">
          Log in to SymbioKnowledgeBase
        </h1>
        <p className="text-center text-sm text-[var(--text-secondary)]">
          Login form will be implemented in Epic 2 (SKB-02.1).
        </p>
      </div>
    </div>
  );
}

import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">
        {APP_NAME}
      </h1>
      <p className="mt-4 text-lg text-[var(--text-secondary)]">
        AI-agent-first knowledge management platform
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/graph"
          className="rounded-lg bg-[var(--accent-primary)] px-6 py-2.5 text-sm font-medium
            text-[var(--text-inverse)] transition-colors hover:bg-[var(--accent-primary-hover)]"
        >
          Open Workspace
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]
            px-6 py-2.5 text-sm font-medium text-[var(--text-primary)]
            transition-colors hover:bg-[var(--bg-hover)]"
        >
          Log In
        </Link>
      </div>
    </main>
  );
}

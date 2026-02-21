import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Database",
};

interface DatabaseViewProps {
  params: Promise<{ id: string }>;
}

export default async function DatabaseView({ params }: DatabaseViewProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-6xl px-8 py-12">
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">
        Database Table View
      </h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Database ID: <code className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-xs">{id}</code>
      </p>
      <p className="mt-4 text-[var(--text-secondary)]">
        The database table view will be implemented in Epic 7 (SKB-07.x).
      </p>
    </div>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page",
};

interface PageViewProps {
  params: Promise<{ id: string }>;
}

export default async function PageView({ params }: PageViewProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">
        Page Editor
      </h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Page ID: <code className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-xs">{id}</code>
      </p>
      <p className="mt-4 text-[var(--text-secondary)]">
        The TipTap block editor will be implemented in Epic 4 (SKB-04.x).
      </p>
    </div>
  );
}

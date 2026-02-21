import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">
        Settings
      </h1>
      <p className="mt-4 text-[var(--text-secondary)]">
        Settings page sections:
      </p>
      <ul className="mt-4 list-inside list-disc space-y-2 text-[var(--text-secondary)]">
        <li>API Key Management (Epic 2 — SKB-02.3)</li>
        <li>User Management (Epic 2 — SKB-02.4)</li>
        <li>Theme Selection (Epic 8)</li>
      </ul>
    </div>
  );
}

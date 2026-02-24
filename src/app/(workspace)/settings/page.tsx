import type { Metadata } from "next";
import ApiKeyManager from "@/components/settings/ApiKeyManager";
import { TeamManagement } from "@/components/settings/TeamManagement";
import { AccountProfileSection } from "@/components/settings/AccountProfileSection";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">
        Settings
      </h1>

      <div className="mt-8">
        <AccountProfileSection />
      </div>

      <div className="mt-12 border-t border-[var(--border-default)] pt-12">
        <ApiKeyManager />
      </div>

      <div className="mt-12 border-t border-[var(--border-default)] pt-12">
        <TeamManagement />
      </div>

      <div className="mt-12 border-t border-[var(--border-default)] pt-12">
        <p className="text-[var(--text-secondary)]">
          Additional settings sections:
        </p>
        <ul className="mt-4 list-inside list-disc space-y-2 text-[var(--text-secondary)]">
          <li>User Management (Epic 2 — SKB-02.4)</li>
          <li>Theme Selection (Epic 8)</li>
        </ul>
      </div>
    </div>
  );
}

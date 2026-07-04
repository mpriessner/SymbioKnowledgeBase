import type { Metadata } from "next";
import { WorkspaceGeneralSettings } from "@/components/settings/WorkspaceGeneralSettings";

export const metadata: Metadata = {
  title: "Workspace Settings",
};

export default function GeneralPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Workspace Settings
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          General settings for your workspace.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border-default)] p-6">
        <WorkspaceGeneralSettings showMeta />
      </div>
    </div>
  );
}

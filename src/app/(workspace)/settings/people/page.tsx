import type { Metadata } from "next";
import { TeamManagement } from "@/components/settings/TeamManagement";

export const metadata: Metadata = {
  title: "People",
};

export default function PeoplePage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          People
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Manage team members and collaboration.
        </p>
      </div>

      <TeamManagement />
    </div>
  );
}

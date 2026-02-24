import type { Metadata } from "next";
import { NotificationsSection } from "@/components/settings/NotificationsSection";

export const metadata: Metadata = {
  title: "Notification Settings",
};

export default function NotificationsSettingsPage() {
  return (
    <div className="w-full content-pad py-12">
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">
        Settings
      </h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Configure your notification preferences.
      </p>

      <div className="mt-8 border-t border-[var(--border-default)] pt-8 max-w-2xl">
        <NotificationsSection />
      </div>
    </div>
  );
}

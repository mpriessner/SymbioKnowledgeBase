import type { Metadata } from "next";
import { PreferencesSection } from "@/components/settings/PreferencesSection";

export const metadata: Metadata = {
  title: "Preferences",
};

export default function PreferencesPage() {
  return (
    <div className="w-full content-pad py-12">
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">
        Preferences
      </h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Customize your display, theme, and locale settings.
      </p>

      <div className="mt-8 border-t border-[var(--border-default)] pt-8">
        <PreferencesSection />
      </div>
    </div>
  );
}

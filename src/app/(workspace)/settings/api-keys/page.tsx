import type { Metadata } from "next";
import { ApiKeysSection } from "@/components/settings/ApiKeysSection";
import ApiKeyManager from "@/components/settings/ApiKeyManager";

export const metadata: Metadata = {
  title: "API Keys",
};

export default function ApiKeysPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          API Keys
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Manage API keys for programmatic access to your knowledge base.
        </p>
      </div>

      <div className="space-y-8">
        <ApiKeysSection />
        
        <div className="border-t border-[var(--border-default)] pt-8">
          <ApiKeyManager />
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import ApiKeyManager from "@/components/settings/ApiKeyManager";

export const metadata: Metadata = {
  title: "API Keys",
};

export default function ApiKeysPage() {
  return (
    <div className="space-y-8">
      <ApiKeyManager />
    </div>
  );
}

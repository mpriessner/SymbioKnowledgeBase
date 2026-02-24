import type { Metadata } from "next";
import { AccountProfileSection } from "@/components/settings/AccountProfileSection";

export const metadata: Metadata = {
  title: "Profile Settings",
};

export default function ProfilePage() {
  return (
    <div className="space-y-8">
      <AccountProfileSection />
    </div>
  );
}

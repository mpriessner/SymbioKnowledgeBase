import type { Metadata } from "next";
import { AccountSecuritySection } from "@/components/settings/AccountSecuritySection";

export const metadata: Metadata = {
  title: "Security",
};

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <AccountSecuritySection />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useUser } from "@/components/providers/SupabaseProvider";
import { ChangePasswordModal } from "./ChangePasswordModal";

interface SecurityRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}

function SecurityRow({ icon, title, description, action }: SecurityRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border-default)] last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-[var(--text-tertiary)]">{icon}</div>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {title}
          </p>
          <p className="text-sm text-[var(--text-tertiary)]">{description}</p>
        </div>
      </div>
      <div className="ml-4">{action}</div>
    </div>
  );
}

export function AccountSecuritySection() {
  const user = useUser();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Check if user has a password set (users might sign up via OAuth)
  // Supabase users with password have identities with provider = 'email'
  const hasPassword = user?.app_metadata?.provider === "email" || 
    user?.identities?.some((i) => i.provider === "email");

  return (
    <div>
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-4">
        Account Security
      </h2>

      <div className="border border-[var(--border-default)] rounded-lg p-4">
        {/* Email Row */}
        <SecurityRow
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
              />
            </svg>
          }
          title={user?.email || "No email"}
          description="Your account email address"
          action={
            <button
              disabled
              className="px-3 py-1.5 text-sm rounded border border-[var(--border-default)] text-[var(--text-tertiary)] cursor-not-allowed opacity-50"
              title="Coming soon"
            >
              Manage emails
            </button>
          }
        />

        {/* Password Row */}
        <SecurityRow
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          }
          title="Password"
          description={
            hasPassword
              ? "Change your account password"
              : "Set a password for your account"
          }
          action={
            <button
              onClick={() => setShowPasswordModal(true)}
              className="px-3 py-1.5 text-sm rounded border border-[var(--border-default)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              {hasPassword ? "Change password" : "Add password"}
            </button>
          }
        />

        {/* Two-step verification Row */}
        <SecurityRow
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          }
          title="Two-step verification"
          description="Add another layer of security to your account"
          action={
            <button
              disabled
              className="px-3 py-1.5 text-sm rounded border border-[var(--border-default)] text-[var(--text-tertiary)] cursor-not-allowed opacity-50"
              title="Coming soon"
            >
              Add verification method
            </button>
          }
        />

        {/* Passkeys Row */}
        <SecurityRow
          icon={
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.864 4.243A7.5 7.5 0 0119.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.465 7.465 0 004.5 10.5a7.464 7.464 0 01-1.15 3.993m1.989 3.559A11.209 11.209 0 008.25 10.5a3.75 3.75 0 117.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 01-3.6 9.75m6.633-4.596a18.666 18.666 0 01-2.485 5.33"
              />
            </svg>
          }
          title="Passkeys"
          description="Sign in with on-device biometric authentication"
          action={
            <button
              disabled
              className="px-3 py-1.5 text-sm rounded border border-[var(--border-default)] text-[var(--text-tertiary)] cursor-not-allowed opacity-50"
              title="Coming soon"
            >
              Add passkey
            </button>
          }
        />
      </div>

      {showPasswordModal && (
        <ChangePasswordModal
          hasExistingPassword={!!hasPassword}
          onClose={() => setShowPasswordModal(false)}
        />
      )}
    </div>
  );
}

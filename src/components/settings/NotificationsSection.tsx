"use client";

import { useState, useEffect } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { Mail, Bell, Volume2, FileText, MessageSquare, Calendar } from "lucide-react";

interface EmailNotificationSettings {
  documentUpdates: boolean;
  commentsAndMentions: boolean;
  weeklyDigest: boolean;
}

interface InAppNotificationSettings {
  showNotifications: boolean;
  playSounds: boolean;
}

interface NotificationSettings {
  email: EmailNotificationSettings;
  inApp: InAppNotificationSettings;
}

const STORAGE_KEY = "symbio-notification-settings";

const DEFAULT_SETTINGS: NotificationSettings = {
  email: {
    documentUpdates: true,
    commentsAndMentions: true,
    weeklyDigest: false,
  },
  inApp: {
    showNotifications: true,
    playSounds: true,
  },
};

interface ToggleRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id: string;
}

function ToggleRow({ icon, title, description, checked, onChange, id }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--border-default)] last:border-b-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-[var(--text-tertiary)]">{icon}</div>
        <div>
          <label
            htmlFor={id}
            className="text-sm font-medium text-[var(--text-primary)] cursor-pointer"
          >
            {title}
          </label>
          <p className="text-sm text-[var(--text-tertiary)]">{description}</p>
        </div>
      </div>
      <div className="ml-4">
        <Toggle
          id={id}
          checked={checked}
          onChange={onChange}
          aria-label={title}
        />
      </div>
    </div>
  );
}

interface NotificationGroupProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function NotificationGroup({ title, icon, children }: NotificationGroupProps) {
  return (
    <div className="mb-8 last:mb-0">
      <div className="flex items-center gap-2 mb-4">
        <div className="text-[var(--text-secondary)]">{icon}</div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h3>
      </div>
      <div className="border border-[var(--border-default)] rounded-lg p-4">
        {children}
      </div>
    </div>
  );
}

export function NotificationsSection() {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error("Failed to load notification settings:", error);
    }
    setIsLoaded(true);
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error("Failed to save notification settings:", error);
      }
    }
  }, [settings, isLoaded]);

  const updateEmailSetting = (key: keyof EmailNotificationSettings, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      email: { ...prev.email, [key]: value },
    }));
  };

  const updateInAppSetting = (key: keyof InAppNotificationSettings, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      inApp: { ...prev.inApp, [key]: value },
    }));
  };

  // Show loading skeleton while hydrating
  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Notifications
        </h2>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-[var(--bg-tertiary)] rounded" />
          <div className="h-32 bg-[var(--bg-tertiary)] rounded-lg" />
          <div className="h-8 w-48 bg-[var(--bg-tertiary)] rounded" />
          <div className="h-24 bg-[var(--bg-tertiary)] rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          Notifications
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Manage how you receive notifications about activity in your workspace.
        </p>
      </div>

      {/* Email Notifications */}
      <NotificationGroup
        title="Email Notifications"
        icon={<Mail className="h-5 w-5" />}
      >
        <ToggleRow
          id="email-document-updates"
          icon={<FileText className="h-5 w-5" />}
          title="Document updates"
          description="Get notified when documents you follow are updated"
          checked={settings.email.documentUpdates}
          onChange={(checked) => updateEmailSetting("documentUpdates", checked)}
        />
        <ToggleRow
          id="email-comments-mentions"
          icon={<MessageSquare className="h-5 w-5" />}
          title="Comments and mentions"
          description="Get notified when someone mentions you or replies to your comments"
          checked={settings.email.commentsAndMentions}
          onChange={(checked) => updateEmailSetting("commentsAndMentions", checked)}
        />
        <ToggleRow
          id="email-weekly-digest"
          icon={<Calendar className="h-5 w-5" />}
          title="Weekly digest"
          description="Receive a weekly summary of activity in your workspace"
          checked={settings.email.weeklyDigest}
          onChange={(checked) => updateEmailSetting("weeklyDigest", checked)}
        />
      </NotificationGroup>

      {/* In-App Notifications */}
      <NotificationGroup
        title="In-App Notifications"
        icon={<Bell className="h-5 w-5" />}
      >
        <ToggleRow
          id="inapp-show-notifications"
          icon={<Bell className="h-5 w-5" />}
          title="Show notifications"
          description="Display notification badges and popups in the app"
          checked={settings.inApp.showNotifications}
          onChange={(checked) => updateInAppSetting("showNotifications", checked)}
        />
        <ToggleRow
          id="inapp-play-sounds"
          icon={<Volume2 className="h-5 w-5" />}
          title="Play sounds"
          description="Play a sound when you receive a new notification"
          checked={settings.inApp.playSounds}
          onChange={(checked) => updateInAppSetting("playSounds", checked)}
        />
      </NotificationGroup>
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect, useSyncExternalStore } from "react";
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

/**
 * Cached snapshot for useSyncExternalStore.
 * useSyncExternalStore compares snapshots with Object.is(), so we must
 * return the same reference when the underlying data hasn't changed.
 */
let cachedSettings: NotificationSettings = DEFAULT_SETTINGS;
let cachedRaw: string | null = null;

function getStoredSettings(): NotificationSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== cachedRaw) {
      cachedRaw = stored;
      if (stored) {
        cachedSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } else {
        cachedSettings = DEFAULT_SETTINGS;
      }
    }
  } catch (error) {
    console.error("Failed to load notification settings:", error);
  }
  return cachedSettings;
}

/**
 * Subscribe to localStorage changes (storage event from other tabs)
 */
function subscribeToStorage(callback: () => void): () => void {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      callback();
    }
  };
  window.addEventListener("storage", handleStorageChange);
  return () => window.removeEventListener("storage", handleStorageChange);
}

/**
 * Custom hook for syncing notification settings with localStorage
 * Uses useSyncExternalStore for proper React 18+ external state management
 */
function useNotificationSettings() {
  // Use useSyncExternalStore for localStorage - the React 18+ recommended approach
  const settings = useSyncExternalStore(
    subscribeToStorage,
    getStoredSettings,
    () => DEFAULT_SETTINGS // Server snapshot
  );

  const updateSettings = useCallback((newSettings: NotificationSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
      // Dispatch a custom event to trigger re-render in the same tab
      window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    } catch (error) {
      console.error("Failed to save notification settings:", error);
    }
  }, []);

  return [settings, updateSettings] as const;
}

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
  const [settings, updateSettings] = useNotificationSettings();
  // Track if component is mounted (for hydration skeleton)
  const [isMounted, setIsMounted] = useState(false);

  // Mark as mounted after first render
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const updateEmailSetting = useCallback((key: keyof EmailNotificationSettings, value: boolean) => {
    const newSettings = {
      ...settings,
      email: { ...settings.email, [key]: value },
    };
    updateSettings(newSettings);
  }, [settings, updateSettings]);

  const updateInAppSetting = useCallback((key: keyof InAppNotificationSettings, value: boolean) => {
    const newSettings = {
      ...settings,
      inApp: { ...settings.inApp, [key]: value },
    };
    updateSettings(newSettings);
  }, [settings, updateSettings]);

  // Show loading skeleton while hydrating
  if (!isMounted) {
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

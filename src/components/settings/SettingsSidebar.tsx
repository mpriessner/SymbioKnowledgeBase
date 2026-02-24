"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  User, 
  Settings, 
  Bell, 
  Building, 
  Users, 
  Shield, 
  Key,
  type LucideIcon 
} from "lucide-react";

interface SettingsItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href: string;
}

interface SettingsSection {
  title: string;
  items: SettingsItem[];
}

const settingsSections: SettingsSection[] = [
  {
    title: "Account",
    items: [
      { id: "profile", label: "Profile", icon: User, href: "/settings/profile" },
      { id: "preferences", label: "Preferences", icon: Settings, href: "/settings/preferences" },
      { id: "notifications", label: "Notifications", icon: Bell, href: "/settings/notifications" },
    ]
  },
  {
    title: "Workspace",
    items: [
      { id: "general", label: "General", icon: Building, href: "/settings/general" },
      { id: "people", label: "People", icon: Users, href: "/settings/people" },
    ]
  },
  {
    title: "Security",
    items: [
      { id: "security", label: "Security", icon: Shield, href: "/settings/security" },
      { id: "api-keys", label: "API Keys", icon: Key, href: "/settings/api-keys" },
    ]
  }
];

/**
 * Settings sidebar navigation component.
 * Displays grouped settings sections with icons and active state highlighting.
 */
export function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-primary)] overflow-y-auto">
      <div className="p-4">
        <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
          Settings
        </h1>
        
        <nav className="space-y-6">
          {settingsSections.map((section) => (
            <div key={section.title}>
              <h2 className="text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)] mb-2 px-2">
                {section.title}
              </h2>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className={`
                          flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm transition-colors
                          ${isActive 
                            ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)] font-medium" 
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
                          }
                        `}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}

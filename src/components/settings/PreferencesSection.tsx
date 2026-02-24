"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Sun, Moon, Monitor, Globe, Calendar, CalendarDays } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

// Types
type Language = "en" | "de" | "es";
type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
type WeekStart = "sunday" | "monday";

// Options
const languages = [
  { value: "en" as const, label: "English" },
  { value: "de" as const, label: "Deutsch" },
  { value: "es" as const, label: "Español" },
];

const dateFormats = [
  { value: "MM/DD/YYYY" as const, label: "MM/DD/YYYY (US)" },
  { value: "DD/MM/YYYY" as const, label: "DD/MM/YYYY (EU)" },
  { value: "YYYY-MM-DD" as const, label: "YYYY-MM-DD (ISO)" },
];

const weekStarts = [
  { value: "sunday" as const, label: "Sunday" },
  { value: "monday" as const, label: "Monday" },
];

// Storage keys
const STORAGE_KEYS = {
  language: "symbio-language",
  dateFormat: "symbio-date-format",
  weekStart: "symbio-week-start",
};

// Custom Select Component
function CustomSelect<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative w-full max-w-xs">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-md border border-[var(--border-default)]
          bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm
          focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)]
          cursor-pointer"
      >
        <span>{selected?.label ?? value}</span>
        <ChevronDown className={`h-4 w-4 text-[var(--text-tertiary)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] py-1 shadow-lg">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left
                ${option.value === value
                  ? "bg-[var(--accent-bg)] text-[var(--accent-primary)] font-medium"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}
            >
              {option.value === value && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
              {option.value !== value && <span className="w-3.5 flex-shrink-0" />}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Setting Row Component
function SettingRow({
  icon: Icon,
  label,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4 border-b border-[var(--border-default)] last:border-b-0">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)]">{label}</h3>
          {description && (
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</p>
          )}
        </div>
      </div>
      <div className="sm:ml-auto">{children}</div>
    </div>
  );
}

// Theme Button Group
function ThemeButtonGroup({
  value,
  onChange,
}: {
  value: "light" | "dark" | "system";
  onChange: (value: "light" | "dark" | "system") => void;
}) {
  const options = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  return (
    <div className="flex rounded-md border border-[var(--border-default)] overflow-hidden">
      {options.map((option) => {
        const Icon = option.icon;
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors
              ${isSelected
                ? "bg-[var(--accent-primary)] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              }
              ${option.value !== "light" ? "border-l border-[var(--border-default)]" : ""}
            `}
            aria-pressed={isSelected}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Week Start Button Group
function WeekStartButtonGroup({
  value,
  onChange,
}: {
  value: WeekStart;
  onChange: (value: WeekStart) => void;
}) {
  return (
    <div className="flex rounded-md border border-[var(--border-default)] overflow-hidden">
      {weekStarts.map((option) => {
        const isSelected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`px-4 py-1.5 text-sm font-medium transition-colors
              ${isSelected
                ? "bg-[var(--accent-primary)] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              }
              ${option.value === "monday" ? "border-l border-[var(--border-default)]" : ""}
            `}
            aria-pressed={isSelected}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// Main Component
export function PreferencesSection() {
  const { theme, setTheme } = useTheme();
  const [language, setLanguageState] = useState<Language>("en");
  const [dateFormat, setDateFormatState] = useState<DateFormat>("YYYY-MM-DD");
  const [weekStart, setWeekStartState] = useState<WeekStart>("monday");
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const storedLanguage = localStorage.getItem(STORAGE_KEYS.language) as Language | null;
      const storedDateFormat = localStorage.getItem(STORAGE_KEYS.dateFormat) as DateFormat | null;
      const storedWeekStart = localStorage.getItem(STORAGE_KEYS.weekStart) as WeekStart | null;

      if (storedLanguage && languages.some((l) => l.value === storedLanguage)) {
        setLanguageState(storedLanguage);
      }
      if (storedDateFormat && dateFormats.some((d) => d.value === storedDateFormat)) {
        setDateFormatState(storedDateFormat);
      }
      if (storedWeekStart && weekStarts.some((w) => w.value === storedWeekStart)) {
        setWeekStartState(storedWeekStart);
      }
    } catch {
      // Ignore storage errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Persist language
  const setLanguage = (value: Language) => {
    setLanguageState(value);
    try {
      localStorage.setItem(STORAGE_KEYS.language, value);
    } catch {
      // Ignore storage errors
    }
  };

  // Persist date format
  const setDateFormat = (value: DateFormat) => {
    setDateFormatState(value);
    try {
      localStorage.setItem(STORAGE_KEYS.dateFormat, value);
    } catch {
      // Ignore storage errors
    }
  };

  // Persist week start
  const setWeekStart = (value: WeekStart) => {
    setWeekStartState(value);
    try {
      localStorage.setItem(STORAGE_KEYS.weekStart, value);
    } catch {
      // Ignore storage errors
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Preferences</h2>
        <div className="animate-pulse space-y-4">
          <div className="h-16 bg-[var(--bg-tertiary)] rounded" />
          <div className="h-16 bg-[var(--bg-tertiary)] rounded" />
          <div className="h-16 bg-[var(--bg-tertiary)] rounded" />
          <div className="h-16 bg-[var(--bg-tertiary)] rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">Preferences</h2>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          Customize your display and locale settings
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-4">
        {/* Theme Setting */}
        <SettingRow
          icon={Sun}
          label="Theme"
          description="Choose your preferred color scheme"
        >
          <ThemeButtonGroup value={theme} onChange={setTheme} />
        </SettingRow>

        {/* Language Setting */}
        <SettingRow
          icon={Globe}
          label="Language"
          description="Select your preferred language"
        >
          <CustomSelect
            value={language}
            options={languages}
            onChange={setLanguage}
          />
        </SettingRow>

        {/* Date Format Setting */}
        <SettingRow
          icon={Calendar}
          label="Date Format"
          description="Choose how dates are displayed"
        >
          <CustomSelect
            value={dateFormat}
            options={dateFormats}
            onChange={setDateFormat}
          />
        </SettingRow>

        {/* Week Starts On Setting */}
        <SettingRow
          icon={CalendarDays}
          label="Week Starts On"
          description="Set the first day of the week"
        >
          <WeekStartButtonGroup value={weekStart} onChange={setWeekStart} />
        </SettingRow>
      </div>

      {/* Info Notice */}
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-4 py-3">
        <p className="text-xs text-[var(--text-tertiary)]">
          Preferences are saved automatically and stored locally in your browser.
        </p>
      </div>
    </div>
  );
}

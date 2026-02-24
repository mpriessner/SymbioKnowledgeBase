"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Copy, Check, Camera, Loader2 } from "lucide-react";

interface ProfileData {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

/**
 * Generate a consistent color from a string (name or email)
 */
function stringToColor(str: string): string {
  const colors = [
    "#E57373", // red
    "#F06292", // pink
    "#BA68C8", // purple
    "#9575CD", // deep purple
    "#7986CB", // indigo
    "#64B5F6", // blue
    "#4FC3F7", // light blue
    "#4DD0E1", // cyan
    "#4DB6AC", // teal
    "#81C784", // green
    "#AED581", // light green
    "#DCE775", // lime
    "#FFD54F", // amber
    "#FFB74D", // orange
    "#FF8A65", // deep orange
  ];

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Get initials from a name or email
 */
function getInitials(name: string | null, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 2).toUpperCase();
}

export function AccountProfileSection() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [preferredName, setPreferredName] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.data);
        setPreferredName(data.data.name || "");
      } else {
        setError("Failed to load profile");
      }
    } catch {
      setError("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (profile) {
      setHasChanges(preferredName !== (profile.name || ""));
    }
  }, [preferredName, profile]);

  const handleSave = async () => {
    if (!hasChanges || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: preferredName || null }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.data);
        setHasChanges(false);
      } else {
        const data = await res.json();
        setError(data.error?.message || "Failed to save profile");
      }
    } catch {
      setError("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyId = async () => {
    if (!profile) return;
    await navigator.clipboard.writeText(profile.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("Image must be less than 2MB");
      return;
    }

    // For now, create a data URL (in production, you'd upload to Supabase Storage)
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      
      setIsSaving(true);
      setError(null);

      try {
        const res = await fetch("/api/settings/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatarUrl: dataUrl }),
        });

        if (res.ok) {
          const data = await res.json();
          setProfile(data.data);
        } else {
          const data = await res.json();
          setError(data.error?.message || "Failed to upload photo");
        }
      } catch {
        setError("Failed to upload photo");
      } finally {
        setIsSaving(false);
      }
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = "";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          My profile
        </h2>
        <div className="flex items-center gap-4 animate-pulse">
          <div className="w-16 h-16 rounded-full bg-[var(--bg-tertiary)]" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-[var(--bg-tertiary)] rounded" />
            <div className="h-3 w-24 bg-[var(--bg-tertiary)] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-[var(--text-primary)]">
          My profile
        </h2>
        <p className="text-[var(--text-secondary)]">Failed to load profile</p>
      </div>
    );
  }

  const avatarColor = stringToColor(profile.name || profile.email);
  const initials = getInitials(profile.name, profile.email);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[var(--text-primary)]">
        My profile
      </h2>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Avatar section */}
      <div className="flex items-start gap-6">
        <div className="relative group">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt="Profile"
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-medium"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
          )}
          <button
            onClick={handlePhotoClick}
            disabled={isSaving}
            className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 
              flex items-center justify-center transition-opacity cursor-pointer"
            title="Change photo"
          >
            {isSaving ? (
              <Loader2 className="h-5 w-5 text-white animate-spin" />
            ) : (
              <Camera className="h-5 w-5 text-white" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="flex-1 space-y-4">
          {/* Preferred name field */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
              Preferred name
            </label>
            <input
              type="text"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              placeholder="Enter your name"
              className="w-full max-w-md px-3 py-2 rounded-md border border-[var(--border-default)] 
                bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm
                focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)]
                placeholder:text-[var(--text-tertiary)]"
            />
            <p className="mt-1 text-xs text-[var(--text-tertiary)]">
              This is how you&apos;ll appear to others
            </p>
          </div>

          {/* Add photo link */}
          <button
            onClick={handlePhotoClick}
            disabled={isSaving}
            className="text-sm text-[var(--accent-primary)] hover:underline disabled:opacity-50"
          >
            {profile.avatarUrl ? "Change photo" : "Add a photo"}
          </button>
        </div>
      </div>

      {/* User ID field */}
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          User ID
        </label>
        <div className="flex items-center gap-2 max-w-md">
          <code className="flex-1 px-3 py-2 rounded-md bg-[var(--bg-secondary)] text-sm 
            font-mono text-[var(--text-secondary)] truncate border border-[var(--border-default)]">
            {profile.id}
          </code>
          <button
            onClick={handleCopyId}
            className="p-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] 
              hover:text-[var(--text-primary)] transition-colors"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
          Your unique identifier (read-only)
        </p>
      </div>

      {/* Save button */}
      <div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--accent-primary)] px-4 py-2 
            text-sm font-medium text-white hover:opacity-90 transition-opacity 
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save changes"
          )}
        </button>
      </div>
    </div>
  );
}

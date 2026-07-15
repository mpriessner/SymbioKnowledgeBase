"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, HardDrive, ShieldCheck, Unplug } from "lucide-react";

interface DriveStatus {
  configured: boolean;
  connected: boolean;
  reconnectNeeded?: boolean;
  connectedAt?: string | null;
}

export default function GoogleDriveSettingsPage() {
  const [status, setStatus] = useState<DriveStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/integrations/google-drive")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || "Unable to load Google Drive settings");
        setStatus(body.data);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load Google Drive settings"));
  }, []);

  async function disconnect() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/integrations/google-drive/disconnect", {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Unable to disconnect Google Drive");
      setStatus((current) => ({ ...(current ?? { configured: true }), connected: false }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to disconnect Google Drive");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Google Drive</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">Connect Drive to search and import files directly from the Add document dialog.</p>
      </div>

      <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-5">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-blue-500/10 p-3 text-blue-500"><HardDrive className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <h2 className="font-medium text-[var(--text-primary)]">Connection</h2>
            {!status && !error && <p className="mt-1 text-sm text-[var(--text-secondary)]">Checking connection…</p>}
            {status && !status.configured && (
              <p className="mt-1 text-sm text-amber-600">Google Drive is not configured on this server. Add the Google OAuth and encryption settings before connecting an account.</p>
            )}
            {status?.configured && status.connected && (
              <div className="mt-2 space-y-3">
                <p className="flex items-center gap-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Connected{status.connectedAt ? ` since ${new Date(status.connectedAt).toLocaleDateString()}` : ""}</p>
                <button type="button" onClick={() => void disconnect()} disabled={busy} className="inline-flex items-center gap-2 rounded-md border border-red-500/30 px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 disabled:opacity-50"><Unplug className="h-4 w-4" /> {busy ? "Disconnecting…" : "Disconnect"}</button>
              </div>
            )}
            {status?.configured && !status.connected && (
              <div className="mt-3">
                {status.reconnectNeeded && <p className="mb-2 text-sm text-amber-600">The saved connection is no longer valid. Connect again to continue.</p>}
                <a href="/api/integrations/google-drive/connect" className="inline-flex rounded-md bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-white">Connect Google Drive</a>
              </div>
            )}
            {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-3 rounded-lg border border-[var(--border-default)] p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-secondary)]" />
        <div>
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Safe access boundary</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">SKB can search, download, and create new files. It cannot edit or delete files already in your Google Drive.</p>
        </div>
      </div>
    </div>
  );
}

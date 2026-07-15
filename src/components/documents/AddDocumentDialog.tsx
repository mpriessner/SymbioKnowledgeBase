"use client";

import { useEffect, useMemo, useState } from "react";
import { FileUp, Link2, Search, Unplug, UploadCloud } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

type SourceTab = "upload" | "link" | "drive";

interface TeamspaceOption {
  id: string;
  name: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

interface DriveStatus {
  configured: boolean;
  connected: boolean;
  reconnectNeeded?: boolean;
}

interface AddDocumentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (pageId: string) => void;
  teamspaces: TeamspaceOption[];
}

async function responseJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message || "The request failed");
  }
  return body;
}

export function AddDocumentDialog({
  isOpen,
  onClose,
  onCreated,
  teamspaces,
}: AddDocumentDialogProps) {
  const [tab, setTab] = useState<SourceTab>("upload");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [location, setLocation] = useState("private");
  const [tagsText, setTagsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [driveQuery, setDriveQuery] = useState("");
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);

  const tags = useMemo(
    () => tagsText.split(",").map((tag) => tag.trim()).filter(Boolean),
    [tagsText]
  );
  const selectedTeamspace = location === "private" ? undefined : location;
  const spacePayload = selectedTeamspace
    ? { space: "team" as const, teamspace_id: selectedTeamspace }
    : { space: "private" as const };

  useEffect(() => {
    if (!isOpen || tab !== "drive" || driveStatus) return;
    let active = true;
    setError(null);
    fetch("/api/integrations/google-drive")
      .then(responseJson)
      .then((body) => {
        if (active) setDriveStatus(body.data);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unable to check Google Drive");
      });
    return () => {
      active = false;
    };
  }, [driveStatus, isOpen, tab]);

  function selectFile(nextFile: File | null) {
    setFile(nextFile);
    if (nextFile && !title.trim()) setTitle(nextFile.name);
  }

  async function addDocument() {
    setError(null);
    if (tab === "upload" && !file) {
      setError("Choose a file to upload.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a document title.");
      return;
    }
    if (tab === "link" && !url.trim()) {
      setError("Enter the document URL.");
      return;
    }

    setBusy(true);
    try {
      const createResponse = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          ...spacePayload,
          source: tab === "link" ? "url" : "upload",
          ...(tab === "link" ? { url: url.trim() } : {}),
          tags,
        }),
      });
      const created = await responseJson(createResponse);
      const pageId = created.data.id as string;

      if (tab === "upload" && file) {
        const formData = new FormData();
        formData.set("file", file);
        await responseJson(
          await fetch(`/api/pages/${pageId}/attachments`, {
            method: "POST",
            body: formData,
          })
        );
      }

      onCreated(pageId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to add document");
    } finally {
      setBusy(false);
    }
  }

  async function searchDrive() {
    if (!driveQuery.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const body = await responseJson(
        await fetch(
          `/api/integrations/google-drive/search?q=${encodeURIComponent(driveQuery.trim())}`
        )
      );
      setDriveFiles(body.data.files);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to search Google Drive");
    } finally {
      setBusy(false);
    }
  }

  async function importDriveFile(driveFile: DriveFile) {
    setBusy(true);
    setError(null);
    try {
      const body = await responseJson(
        await fetch("/api/integrations/google-drive/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_id: driveFile.id,
            ...spacePayload,
            tags,
          }),
        })
      );
      onCreated(body.data.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to import from Google Drive");
    } finally {
      setBusy(false);
    }
  }

  async function disconnectDrive() {
    setBusy(true);
    setError(null);
    try {
      await responseJson(
        await fetch("/api/integrations/google-drive/disconnect", { method: "POST" })
      );
      setDriveStatus({ configured: true, connected: false });
      setDriveFiles([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to disconnect Google Drive");
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    { id: "upload" as const, label: "Upload", icon: FileUp },
    { id: "link" as const, label: "Link", icon: Link2 },
    { id: "drive" as const, label: "Google Drive", icon: UploadCloud },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add document">
      <div className="space-y-4">
        <div role="tablist" aria-label="Document source" className="grid grid-cols-3 gap-1 rounded-lg bg-[var(--bg-secondary)] p-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-sm ${
                tab === id
                  ? "bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div>
          <label htmlFor="document-location" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Location</label>
          <select
            id="document-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="private">Private space (visible to workspace members)</option>
            {teamspaces.map((teamspace) => (
              <option key={teamspace.id} value={teamspace.id}>{teamspace.name}</option>
            ))}
          </select>
        </div>

        {tab !== "drive" && (
          <>
            <div>
              <label htmlFor="document-title" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Document title</label>
              <input
                id="document-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={tab === "upload" ? "Defaults to the filename" : "e.g. Lab safety protocol"}
                className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>

            {tab === "upload" ? (
              <div key="upload-file">
                <label htmlFor="document-file" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Choose file</label>
                <input
                  id="document-file"
                  type="file"
                  onChange={(event) => selectFile(event.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-[var(--text-secondary)] file:mr-3 file:rounded-md file:border-0 file:bg-[var(--bg-secondary)] file:px-3 file:py-2 file:text-[var(--text-primary)]"
                />
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">Maximum file size: 50 MB.</p>
              </div>
            ) : (
              <div key="link-url">
                <label htmlFor="document-url" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Document URL</label>
                <input
                  id="document-url"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
                <p className="mt-1 text-xs text-[var(--text-tertiary)]">A safe text snapshot is added when the source allows it. The link still saves if fetching fails.</p>
              </div>
            )}
          </>
        )}

        {tab === "drive" && (
          <div className="space-y-3">
            {!driveStatus && !error && <p className="text-sm text-[var(--text-secondary)]">Checking Google Drive…</p>}
            {driveStatus && !driveStatus.configured && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-[var(--text-primary)]">
                <p className="font-medium">Google Drive is not configured on this server.</p>
                <p className="mt-1 text-[var(--text-secondary)]">An administrator needs to add the Google OAuth client and token-encryption settings.</p>
              </div>
            )}
            {driveStatus?.configured && !driveStatus.connected && (
              <div className="rounded-md border border-[var(--border-default)] p-4 text-center">
                <p className="text-sm text-[var(--text-secondary)]">{driveStatus.reconnectNeeded ? "Your Google Drive connection needs to be renewed." : "Connect Google Drive to search and import files."}</p>
                <a href="/api/integrations/google-drive/connect" className="mt-3 inline-flex rounded-md bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-white">Connect Google Drive</a>
              </div>
            )}
            {driveStatus?.connected && (
              <>
                <div className="flex gap-2">
                  <input
                    aria-label="Search Google Drive"
                    value={driveQuery}
                    onChange={(event) => setDriveQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void searchDrive();
                    }}
                    placeholder="Search file names"
                    className="min-w-0 flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]"
                  />
                  <button type="button" onClick={() => void searchDrive()} disabled={busy || !driveQuery.trim()} className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                    <Search className="h-4 w-4" /> Search
                  </button>
                </div>
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {driveFiles.map((driveFile) => (
                    <div key={driveFile.id} className="flex items-center gap-3 rounded-md border border-[var(--border-default)] p-3">
                      <FileUp className="h-5 w-5 shrink-0 text-[var(--text-tertiary)]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--text-primary)]">{driveFile.name}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">Modified {new Date(driveFile.modifiedTime).toLocaleDateString()}</p>
                      </div>
                      <button type="button" aria-label={`Import ${driveFile.name}`} onClick={() => void importDriveFile(driveFile)} disabled={busy} className="rounded-md border border-[var(--border-default)] px-2.5 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] disabled:opacity-50">Import</button>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => void disconnectDrive()} disabled={busy} className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-red-500 disabled:opacity-50">
                  <Unplug className="h-3.5 w-3.5" /> Disconnect Google Drive
                </button>
              </>
            )}
          </div>
        )}

        <div>
          <label htmlFor="document-tags" className="mb-1 block text-sm font-medium text-[var(--text-primary)]">Tags <span className="font-normal text-[var(--text-tertiary)]">(optional)</span></label>
          <input id="document-tags" value={tagsText} onChange={(event) => setTagsText(event.target.value)} placeholder="protocol, safety, chemistry" className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]" />
        </div>

        {error && <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</p>}

        {tab !== "drive" && (
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-md border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-primary)]">Cancel</button>
            <button type="button" onClick={() => void addDocument()} disabled={busy} className="rounded-md bg-[var(--accent-primary)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? "Adding…" : "Add document"}</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

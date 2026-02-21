"use client";

import { useState, useEffect, useCallback } from "react";

interface ApiKeyListItem {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  isRevoked: boolean;
}

interface NewKeyResponse {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  createdAt: string;
}

export default function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Create key form state
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Copy-once modal state
  const [newlyCreatedKey, setNewlyCreatedKey] =
    useState<NewKeyResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const response = await fetch("/api/keys");
      if (!response.ok) {
        throw new Error("Failed to fetch API keys");
      }
      const body = await response.json();
      setKeys(body.data);
    } catch (err) {
      setError("Failed to load API keys");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError("");

    try {
      const response = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName }),
      });

      if (!response.ok) {
        const body = await response.json();
        setError(body.error?.message || "Failed to create API key");
        return;
      }

      const body = await response.json();
      setNewlyCreatedKey(body.data);
      setNewKeyName("");
      setShowCreateForm(false);
      setCopied(false);

      // Refresh the key list
      await fetchKeys();
    } catch {
      setError("Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    setRevokingId(id);
    setError("");

    try {
      const response = await fetch(`/api/keys/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = await response.json();
        setError(body.error?.message || "Failed to revoke API key");
        return;
      }

      // Refresh the key list
      await fetchKeys();
    } catch {
      setError("Failed to revoke API key");
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopyKey = async () => {
    if (newlyCreatedKey) {
      try {
        await navigator.clipboard.writeText(newlyCreatedKey.key);
        setCopied(true);
      } catch {
        // Fallback: select the text for manual copy
        const textArea = document.querySelector(
          "[data-key-display]"
        ) as HTMLInputElement;
        if (textArea) {
          textArea.select();
        }
      }
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatLastUsed = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Just now";
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 30)
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return formatDate(dateStr);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-32 rounded bg-gray-200 dark:bg-gray-700" />
        <div className="h-20 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          API Keys
        </h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          + Generate New API Key
        </button>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-400">
        API keys allow AI agents to access your knowledge base
        programmatically. Include the key in the{" "}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-gray-800">
          Authorization: Bearer &lt;key&gt;
        </code>{" "}
        header.
      </p>

      {error && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Create Key Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateKey}
          className="flex gap-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
        >
          <input
            type="text"
            placeholder="Key name (e.g., Lab Companion Agent)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            required
            maxLength={100}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
          />
          <button
            type="submit"
            disabled={isCreating || !newKeyName.trim()}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isCreating ? "Generating..." : "Generate"}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateForm(false)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Newly Created Key Modal */}
      {newlyCreatedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              API Key Created: {newlyCreatedKey.name}
            </h3>

            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Your new API key is shown below. Copy it now — it will not be
              displayed again.
            </p>

            <div className="mt-4 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={newlyCreatedKey.key}
                data-key-display=""
                className="flex-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <button
                onClick={handleCopyKey}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            <div className="mt-4 rounded-md bg-amber-50 p-3 dark:bg-amber-900/20">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                WARNING: This key will not be shown again. Store it securely
                before closing this dialog.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setNewlyCreatedKey(null)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
              >
                I&apos;ve copied the key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Key List */}
      {keys.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No API keys yet. Generate one to get started.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Key
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Last Used
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-900">
              {keys.map((apiKey) => (
                <tr key={apiKey.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {apiKey.name}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-sm text-gray-500 dark:text-gray-400">
                    skb_live_{apiKey.keyPrefix}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(apiKey.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {apiKey.isRevoked
                      ? "---"
                      : formatLastUsed(apiKey.lastUsedAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    {apiKey.isRevoked ? (
                      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                        Revoked
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    {!apiKey.isRevoked && (
                      <button
                        onClick={() => handleRevokeKey(apiKey.id)}
                        disabled={revokingId === apiKey.id}
                        className="text-red-600 hover:text-red-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
                      >
                        {revokingId === apiKey.id ? "Revoking..." : "Revoke"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

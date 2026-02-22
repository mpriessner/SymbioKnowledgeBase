"use client";

import { useState, useEffect, useCallback } from "react";
import { Key, Copy, Trash2, Plus, Check } from "lucide-react";

interface ApiKeyInfo {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
}

export function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["read", "write"]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/api-keys");
      if (res.ok) {
        const data = await res.json();
        setKeys(data.data);
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setIsCreating(true);

    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim(), scopes: newKeyScopes }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.data.key);
        setShowCreateForm(false);
        setNewKeyName("");
        setNewKeyScopes(["read", "write"]);
        fetchKeys();
      }
    } catch {
      // Silently fail
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
      }
    } catch {
      // Silently fail
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">
            API Keys
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Manage API keys for agent access to the knowledge base.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3.5 w-3.5" />
          Generate Key
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="rounded-md border border-[var(--border-default)] p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Key Name
            </label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g., Production Agent"
              className="w-full max-w-md px-3 py-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-primary)] mb-1">
              Scopes
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={newKeyScopes.includes("read")}
                  onChange={() => toggleScope("read")}
                  className="rounded"
                />
                Read
              </label>
              <label className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                <input
                  type="checkbox"
                  checked={newKeyScopes.includes("write")}
                  onChange={() => toggleScope("write")}
                  className="rounded"
                />
                Write
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={isCreating || !newKeyName.trim() || newKeyScopes.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-primary)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isCreating ? "Generating..." : "Generate"}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="rounded-md px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Created key display */}
      {createdKey && (
        <div className="rounded-md border border-green-500/30 bg-green-500/5 p-4 space-y-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Your API key (save this — you won&apos;t see it again!):
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-[var(--bg-secondary)] px-3 py-2 text-sm font-mono text-[var(--text-primary)] break-all">
              {createdKey}
            </code>
            <button
              onClick={() => handleCopy(createdKey)}
              className="rounded p-2 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Done
          </button>
        </div>
      )}

      {/* Keys list */}
      {isLoading ? (
        <p className="text-sm text-[var(--text-secondary)]">Loading...</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">
          No API keys yet. Generate one to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {keys.map((key) => (
            <div
              key={key.id}
              className="flex items-center justify-between rounded-md border border-[var(--border-default)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Key className="h-4 w-4 text-[var(--text-secondary)]" />
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {key.name}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {key.key_prefix}... &middot; Scopes:{" "}
                    {key.scopes.join(", ")} &middot; Last used:{" "}
                    {key.last_used_at
                      ? new Date(key.last_used_at).toLocaleDateString()
                      : "never"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRevoke(key.id)}
                className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-red-500/10 hover:text-red-500 transition-colors"
                title="Revoke key"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

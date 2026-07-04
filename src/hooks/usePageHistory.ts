"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import type { JSONContent } from "@tiptap/react";

// Query key factory for page version history.
export const historyKeys = {
  all: ["pageHistory"] as const,
  list: (pageId: string) => ["pageHistory", "list", pageId] as const,
  detail: (pageId: string, version: number) =>
    ["pageHistory", "detail", pageId, version] as const,
};

/** A row in the version list (mirrors listDocumentVersions output). */
export interface HistoryVersion {
  id: string;
  version: number;
  change_type: string;
  change_source: string | null;
  change_notes: string | null;
  created_at: string;
  word_count: number;
}

/** Full detail for a single version (content + plain text). */
export interface HistoryVersionDetail {
  id: string;
  version: number;
  content: JSONContent;
  plain_text: string;
  change_type: string;
  change_source: string | null;
  change_notes: string | null;
  created_at: string;
}

/** Result of a successful restore. */
export interface RestoreResponse {
  id: string;
  version: number;
  change_type: string;
  change_notes: string | null;
  created_at: string;
  /** Editor concurrency token (Block.version) after the in-place write-back. */
  block_version: number;
}

async function fetchHistory(pageId: string): Promise<HistoryVersion[]> {
  const res = await fetch(`/api/pages/${pageId}/history`);
  if (!res.ok) {
    throw new Error(`Failed to load history: ${res.status}`);
  }
  const json = (await res.json()) as { data: HistoryVersion[] };
  return json.data;
}

async function fetchVersionDetail(
  pageId: string,
  version: number
): Promise<HistoryVersionDetail> {
  const res = await fetch(`/api/pages/${pageId}/history/${version}`);
  if (!res.ok) {
    throw new Error(`Failed to load version ${version}: ${res.status}`);
  }
  const json = (await res.json()) as { data: HistoryVersionDetail };
  return json.data;
}

async function restoreVersion(
  pageId: string,
  version: number
): Promise<RestoreResponse> {
  const res = await fetch(`/api/pages/${pageId}/history/${version}`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(
      err?.error?.message || `Failed to restore version ${version}: ${res.status}`
    );
  }
  const json = (await res.json()) as { data: RestoreResponse };
  return json.data;
}

/** Load the version list for a page. */
export function usePageHistory(pageId: string, enabled: boolean = true) {
  return useQuery({
    queryKey: historyKeys.list(pageId),
    queryFn: () => fetchHistory(pageId),
    enabled: enabled && !!pageId,
    staleTime: 10_000,
  });
}

/** Load full detail (content + plain text) for one version. */
export function usePageVersionDetail(
  pageId: string,
  version: number | null,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: historyKeys.detail(pageId, version ?? -1),
    queryFn: () => fetchVersionDetail(pageId, version as number),
    enabled: enabled && !!pageId && version !== null,
    staleTime: 30_000,
  });
}

/** Restore a page to a version (server writes content back to the block). */
export function useRestoreVersion(pageId: string) {
  return useMutation({
    mutationFn: (version: number) => restoreVersion(pageId, version),
  });
}

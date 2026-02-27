/**
 * Sweep-related TypeScript types.
 */

export type SweepStatus = "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type SweepPageAction =
  | "SUMMARY_REGENERATED"
  | "SUMMARY_GENERATED"
  | "LINKS_DISCOVERED"
  | "SKIPPED"
  | "ERROR";

export interface SweepOptions {
  budget: number;
  tenantId: string;
  dryRun?: boolean;
  autoLink?: boolean;
}

export interface SweepSessionData {
  id: string;
  tenantId: string;
  startedAt: Date;
  completedAt: Date | null;
  budget: number;
  status: SweepStatus;
  results: SweepResults;
}

export interface SweepResults {
  pagesProcessed: number;
  summariesRegenerated: number;
  summariesSkipped: number;
  linkSuggestionsFound: number;
  errors: number;
}

export interface SweepPageLogEntry {
  pageId: string;
  title: string;
  action: SweepPageAction;
  reason: string;
  suggestions?: string[];
  durationMs: number;
}

export interface LinkSuggestion {
  sourcePageId: string;
  targetPageId: string;
  targetTitle: string;
  confidence: number;
  context: string;
}

export interface SweepReport {
  session: SweepSessionData;
  pageLog: SweepPageLogEntry[];
  linkSuggestions: LinkSuggestion[];
}

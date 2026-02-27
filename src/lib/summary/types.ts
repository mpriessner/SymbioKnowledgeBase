/**
 * Summary-related TypeScript types.
 */

export interface SummaryResult {
  oneLiner: string;
  summary: string;
}

export interface LLMResponse extends SummaryResult {
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface LLMProvider {
  generateSummary(title: string, content: string): Promise<LLMResponse>;
}

export interface BatchOptions {
  overwrite?: boolean;
  dryRun?: boolean;
  limit?: number;
}

export interface BatchResult {
  processed: number;
  skipped: number;
  errors: number;
  total: number;
}

export interface SummaryLogEntry {
  pageId: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  estimatedCost: number;
  timestamp: string;
}

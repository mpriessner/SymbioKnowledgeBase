export interface PageResult {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
}

export interface PageSearchResult {
  id: string;
  title: string;
  icon: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertResult {
  action: "created" | "updated" | "skipped";
  pageId: string;
  title: string;
  contentHash: string;
}

export interface WriterConfig {
  apiUrl: string;
  apiKey: string;
  rateLimit?: number;
  maxRetries?: number;
}

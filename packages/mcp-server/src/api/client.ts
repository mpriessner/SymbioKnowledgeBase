/**
 * Agent API client for the MCP server.
 * Communicates with SymbioKnowledgeBase REST endpoints.
 */

export interface PageSummary {
  id: string;
  title: string;
  icon: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PageWithMarkdown extends PageSummary {
  markdown: string;
}

export interface SearchResult {
  page_id: string;
  title: string;
  icon: string | null;
  snippet: string;
  score: number;
}

export interface GraphNode {
  id: string;
  label: string;
  icon: string | null;
  link_count: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: { total: number; limit: number; offset: number };
}

export interface ApiResponse<T> {
  data: T;
  meta: Record<string, unknown>;
}

export interface BacklinkEntry {
  id: string;
  title: string;
  icon: string | null;
}

export interface DatabaseSummary {
  id: string;
  title: string;
  page_id: string;
  icon: string | null;
  column_count: number;
  row_count: number;
  created_at: string;
  updated_at: string;
}

export interface DatabaseDetail {
  id: string;
  title: string;
  page_id: string;
  icon: string | null;
  schema: { columns: Array<{ id: string; name: string; type: string; options?: string[] }> };
  row_count: number;
  created_at: string;
  updated_at: string;
}

export interface DbRowEntry {
  id: string;
  properties: Record<string, unknown>;
  page_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentClient {
  search(
    query: string,
    limit?: number,
    offset?: number
  ): Promise<ApiListResponse<SearchResult>>;
  readPage(id: string): Promise<ApiResponse<PageWithMarkdown>>;
  createPage(
    title: string,
    markdown?: string,
    parentId?: string
  ): Promise<ApiResponse<{ id: string; title: string; created_at: string }>>;
  updatePage(
    id: string,
    markdown: string
  ): Promise<ApiResponse<{ id: string; updated_at: string }>>;
  deletePage(
    id: string
  ): Promise<ApiResponse<{ id: string; deleted_at: string }>>;
  listPages(
    parentId?: string,
    limit?: number,
    offset?: number
  ): Promise<ApiListResponse<PageSummary>>;
  getBacklinks(id: string): Promise<ApiResponse<BacklinkEntry[]>>;
  getGraph(
    pageId?: string,
    depth?: number
  ): Promise<
    ApiResponse<{ nodes: GraphNode[]; edges: GraphEdge[] }>
  >;
  listDatabases(): Promise<ApiListResponse<DatabaseSummary>>;
  readDatabase(id: string): Promise<ApiResponse<DatabaseDetail>>;
  queryRows(
    databaseId: string,
    limit?: number,
    offset?: number
  ): Promise<ApiListResponse<DbRowEntry>>;
  createRow(
    databaseId: string,
    properties: Record<string, unknown>
  ): Promise<ApiResponse<{ id: string; properties: Record<string, unknown>; created_at: string }>>;
  updateRow(
    databaseId: string,
    rowId: string,
    properties: Record<string, unknown>
  ): Promise<ApiResponse<{ id: string; properties: Record<string, unknown>; updated_at: string }>>;
  deleteRow(
    databaseId: string,
    rowId: string
  ): Promise<ApiResponse<{ id: string; deleted_at: string }>>;
}

export function createAgentClient(
  baseUrl: string,
  authToken: string
): AgentClient {
  async function callAPI<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${baseUrl}/api/agent${endpoint}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
          ...(options.headers as Record<string, string>),
        },
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: { message: "Unknown error" } }));
        throw new Error(
          `API Error (${response.status}): ${(error as Record<string, Record<string, string>>).error?.message || response.statusText}`
        );
      }

      return response.json() as Promise<T>;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error(`Request timeout after 10s: ${endpoint}`);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async search(query, limit = 20, offset = 0) {
      const params = new URLSearchParams({
        q: query,
        limit: String(limit),
        offset: String(offset),
      });
      return callAPI<ApiListResponse<SearchResult>>(`/search?${params}`);
    },

    async readPage(id) {
      return callAPI<ApiResponse<PageWithMarkdown>>(`/pages/${id}`);
    },

    async createPage(title, markdown?, parentId?) {
      const body: Record<string, string> = { title };
      if (markdown) body.markdown = markdown;
      if (parentId) body.parent_id = parentId;

      return callAPI<
        ApiResponse<{ id: string; title: string; created_at: string }>
      >("/pages", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    async updatePage(id, markdown) {
      return callAPI<ApiResponse<{ id: string; updated_at: string }>>(
        `/pages/${id}`,
        {
          method: "PUT",
          body: JSON.stringify({ markdown }),
        }
      );
    },

    async deletePage(id) {
      return callAPI<ApiResponse<{ id: string; deleted_at: string }>>(
        `/pages/${id}`,
        { method: "DELETE" }
      );
    },

    async getBacklinks(id) {
      return callAPI<ApiResponse<BacklinkEntry[]>>(
        `/pages/${id}/backlinks`
      );
    },

    async listPages(parentId?, limit = 50, offset = 0) {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      if (parentId) params.set("parent_id", parentId);
      return callAPI<ApiListResponse<PageSummary>>(`/pages?${params}`);
    },

    async getGraph(pageId?, depth = 2) {
      const params = new URLSearchParams({ depth: String(depth) });
      if (pageId) params.set("pageId", pageId);
      return callAPI<
        ApiResponse<{ nodes: GraphNode[]; edges: GraphEdge[] }>
      >(`/graph?${params}`);
    },

    async listDatabases() {
      return callAPI<ApiListResponse<DatabaseSummary>>("/databases");
    },

    async readDatabase(id) {
      return callAPI<ApiResponse<DatabaseDetail>>(`/databases/${id}`);
    },

    async queryRows(databaseId, limit = 50, offset = 0) {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      });
      return callAPI<ApiListResponse<DbRowEntry>>(
        `/databases/${databaseId}/rows?${params}`
      );
    },

    async createRow(databaseId, properties) {
      return callAPI<
        ApiResponse<{ id: string; properties: Record<string, unknown>; created_at: string }>
      >(`/databases/${databaseId}/rows`, {
        method: "POST",
        body: JSON.stringify({ properties }),
      });
    },

    async updateRow(databaseId, rowId, properties) {
      return callAPI<
        ApiResponse<{ id: string; properties: Record<string, unknown>; updated_at: string }>
      >(`/databases/${databaseId}/rows/${rowId}`, {
        method: "PUT",
        body: JSON.stringify({ properties }),
      });
    },

    async deleteRow(databaseId, rowId) {
      return callAPI<ApiResponse<{ id: string; deleted_at: string }>>(
        `/databases/${databaseId}/rows/${rowId}`,
        { method: "DELETE" }
      );
    },
  };
}

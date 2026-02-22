# Story SKB-15.2: MCP Server Implementation

**Epic:** Epic 15 - Agent API & MCP Server
**Story ID:** SKB-15.2
**Story Points:** 13 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-15.1 (REST Agent API must exist), EPIC-14 (Markdown conversion)

---

## User Story

As a Claude Desktop user, I want a Model Context Protocol server that exposes SymbioKnowledgeBase as a knowledge source, So that I can search, read, and create knowledge base pages directly from Claude without switching contexts.

---

## Acceptance Criteria

- [ ] MCP server implemented using `@modelcontextprotocol/sdk`
- [ ] Follows MCP specification v1.0
- [ ] **Tools implemented:**
  - `search_pages(query: string, limit?: number)` → `SearchResult[]`
  - `read_page(id_or_title: string)` → `{ markdown, metadata }`
  - `create_page(title: string, markdown?: string, parent_id?: string)` → `{ id, title }`
  - `update_page(id: string, markdown: string)` → `{ success, updated_at }`
  - `list_pages(parent_id?: string, sort?: string)` → `Page[]`
  - `get_graph(page_id?: string, depth?: number)` → `{ nodes, edges }`
  - `get_recent_pages(limit?: number)` → `Page[]`
- [ ] **Resources implemented:**
  - `pages://list` → All page titles with IDs
  - `pages://{id}` → Full markdown content for page
  - `graph://overview` → Knowledge graph summary
- [ ] **Transport modes:**
  - stdio transport for local use (Claude Desktop)
  - HTTP transport with SSE for remote use
- [ ] **Authentication:**
  - Reads Supabase JWT from `SYMBIO_AUTH_TOKEN` environment variable
  - Passes token to Agent API via Authorization header
- [ ] **Configuration guide:**
  - `claude_desktop_config.json` example for Claude Desktop integration
  - Environment variable documentation
- [ ] Error handling: Returns MCP-compliant error responses
- [ ] Logging: Debug logs to stderr (for stdio transport)
- [ ] Package: Standalone npm package in `packages/mcp-server/`
- [ ] CLI: `npx @symbio/mcp-server` starts server
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
MCP Server Architecture
───────────────────────────

┌─────────────────────────────────────────────────────────────────────┐
│  Claude Desktop                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  User: "Search for machine learning pages"                     │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Claude triggers MCP tool: search_pages("machine learning")    │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                               │ stdio (JSON-RPC)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MCP Server (packages/mcp-server/index.ts)                          │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Server initialization                                          ││
│  │    const server = new McpServer({                               ││
│  │      name: "symbio-knowledge-base",                             ││
│  │      version: "1.0.0"                                           ││
│  │    });                                                          ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Tools Registry                                                 ││
│  │                                                                 ││
│  │  search_pages      → tools/search.ts                           ││
│  │  read_page         → tools/read.ts                             ││
│  │  create_page       → tools/create.ts                           ││
│  │  update_page       → tools/update.ts                           ││
│  │  list_pages        → tools/list.ts                             ││
│  │  get_graph         → tools/graph.ts                            ││
│  │  get_recent_pages  → tools/recent.ts                           ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Resources Registry                                             ││
│  │                                                                 ││
│  │  pages://list      → resources/pagesList.ts                    ││
│  │  pages://{id}      → resources/pageContent.ts                  ││
│  │  graph://overview  → resources/graphOverview.ts                ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Transport Layer                                                ││
│  │                                                                 ││
│  │  if (process.stdin.isTTY) {                                     ││
│  │    // HTTP/SSE transport (for remote clients)                  ││
│  │    app.listen(3001)                                             ││
│  │  } else {                                                       ││
│  │    // stdio transport (for Claude Desktop)                     ││
│  │    server.connect(process.stdin, process.stdout)               ││
│  │  }                                                              ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Agent API Client                                               ││
│  │                                                                 ││
│  │  async function callAgentAPI(endpoint, options) {              ││
│  │    const token = process.env.SYMBIO_AUTH_TOKEN;                ││
│  │    const response = await fetch(                                ││
│  │      `http://localhost:3000/api/agent${endpoint}`,             ││
│  │      {                                                          ││
│  │        headers: { Authorization: `Bearer ${token}` },          ││
│  │        ...options                                               ││
│  │      }                                                          ││
│  │    );                                                           ││
│  │    return response.json();                                      ││
│  │  }                                                              ││
│  └────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
                               │ HTTP
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SymbioKnowledgeBase Agent API (http://localhost:3000)             │
│                                                                      │
│  GET /api/agent/search?q=machine+learning                           │
│  → { data: SearchResult[], meta: { total, limit } }                │
└─────────────────────────────────────────────────────────────────────┘

Tool Execution Flow:
┌─────────────────────────────────────────────────────────────────────┐
│  1. Claude Desktop calls tool via JSON-RPC                          │
│     {                                                                │
│       jsonrpc: "2.0",                                                │
│       method: "tools/call",                                          │
│       params: {                                                      │
│         name: "search_pages",                                        │
│         arguments: { query: "machine learning", limit: 10 }          │
│       }                                                              │
│     }                                                                │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. MCP Server routes to tool handler                               │
│     const handler = tools.get("search_pages");                      │
│     const result = await handler(params.arguments);                 │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. Tool handler calls Agent API                                    │
│     const response = await callAgentAPI(                            │
│       `/search?q=${query}&limit=${limit}`                           │
│     );                                                               │
│     return response.data.map(formatSearchResult);                   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. MCP Server returns result to Claude                             │
│     {                                                                │
│       jsonrpc: "2.0",                                                │
│       result: {                                                      │
│         content: [                                                   │
│           { type: "text", text: "Found 3 results:\n1. ML Basics..." }│
│         ]                                                            │
│       }                                                              │
│     }                                                                │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Initialize MCP Server Package

**File: `packages/mcp-server/package.json`**

```json
{
  "name": "@symbio/mcp-server",
  "version": "1.0.0",
  "description": "Model Context Protocol server for SymbioKnowledgeBase",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "mcp-server-symbio": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "node-fetch": "^3.3.2",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.11.5",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**File: `packages/mcp-server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/__tests__/**"]
}
```

---

### Step 2: Implement Core Server

**File: `packages/mcp-server/src/index.ts`**

```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools/index.js';
import { registerResources } from './resources/index.js';
import { createAgentClient } from './api/client.js';

async function main() {
  // Validate environment
  const authToken = process.env.SYMBIO_AUTH_TOKEN;
  const apiUrl = process.env.SYMBIO_API_URL || 'http://localhost:3000';

  if (!authToken) {
    console.error('Error: SYMBIO_AUTH_TOKEN environment variable is required');
    process.exit(1);
  }

  // Create MCP server
  const server = new Server(
    {
      name: 'symbio-knowledge-base',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Create API client
  const apiClient = createAgentClient(apiUrl, authToken);

  // Register tools and resources
  registerTools(server, apiClient);
  registerResources(server, apiClient);

  // Set up error handling
  server.onerror = (error) => {
    console.error('[MCP Error]', error);
  };

  process.on('SIGINT', async () => {
    await server.close();
    process.exit(0);
  });

  // Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('SymbioKnowledgeBase MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

---

### Step 3: Implement API Client

**File: `packages/mcp-server/src/api/client.ts`**

```typescript
import fetch from 'node-fetch';

export interface AgentClient {
  search(query: string, limit?: number, offset?: number): Promise<any>;
  readPage(id: string): Promise<any>;
  createPage(title: string, markdown?: string, parentId?: string): Promise<any>;
  updatePage(id: string, markdown: string): Promise<any>;
  listPages(parentId?: string, limit?: number, offset?: number): Promise<any>;
  getGraph(pageId?: string, depth?: number): Promise<any>;
}

export function createAgentClient(baseUrl: string, authToken: string): AgentClient {
  async function callAPI(endpoint: string, options: any = {}) {
    const url = `${baseUrl}/api/agent${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
      throw new Error(`API Error: ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  return {
    async search(query: string, limit = 20, offset = 0) {
      const params = new URLSearchParams({ q: query, limit: String(limit), offset: String(offset) });
      return callAPI(`/search?${params}`);
    },

    async readPage(id: string) {
      return callAPI(`/pages/${id}`);
    },

    async createPage(title: string, markdown?: string, parentId?: string) {
      return callAPI('/pages', {
        method: 'POST',
        body: JSON.stringify({ title, markdown, parent_id: parentId }),
      });
    },

    async updatePage(id: string, markdown: string) {
      return callAPI(`/pages/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ markdown }),
      });
    },

    async listPages(parentId?: string, limit = 50, offset = 0) {
      const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
      if (parentId) params.set('parent_id', parentId);
      return callAPI(`/pages?${params}`);
    },

    async getGraph(pageId?: string, depth = 2) {
      const params = new URLSearchParams({ depth: String(depth) });
      if (pageId) params.set('pageId', pageId);
      return callAPI(`/graph?${params}`);
    },
  };
}
```

---

### Step 4: Implement Tools

**File: `packages/mcp-server/src/tools/index.ts`**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { AgentClient } from '../api/client.js';
import { z } from 'zod';

export function registerTools(server: Server, apiClient: AgentClient) {
  // search_pages tool
  server.setRequestHandler('tools/list', async () => ({
    tools: [
      {
        name: 'search_pages',
        description: 'Search knowledge base pages by query string. Returns page titles, snippets, and relevance scores.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', description: 'Max results (default 20)', default: 20 },
          },
          required: ['query'],
        },
      },
      {
        name: 'read_page',
        description: 'Read a page by ID or title. Returns full markdown content and metadata.',
        inputSchema: {
          type: 'object',
          properties: {
            id_or_title: { type: 'string', description: 'Page ID (UUID) or exact title' },
          },
          required: ['id_or_title'],
        },
      },
      {
        name: 'create_page',
        description: 'Create a new knowledge base page with optional markdown content.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Page title' },
            markdown: { type: 'string', description: 'Page content in markdown format' },
            parent_id: { type: 'string', description: 'Parent page ID (for nested pages)' },
          },
          required: ['title'],
        },
      },
      {
        name: 'update_page',
        description: 'Update a page\'s markdown content by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Page ID (UUID)' },
            markdown: { type: 'string', description: 'New markdown content' },
          },
          required: ['id', 'markdown'],
        },
      },
      {
        name: 'list_pages',
        description: 'List all pages or filter by parent folder.',
        inputSchema: {
          type: 'object',
          properties: {
            parent_id: { type: 'string', description: 'Parent page ID (omit for all pages)' },
            limit: { type: 'number', description: 'Max results (default 50)', default: 50 },
          },
        },
      },
      {
        name: 'get_graph',
        description: 'Get knowledge graph with nodes and edges. Optional: center on specific page.',
        inputSchema: {
          type: 'object',
          properties: {
            page_id: { type: 'string', description: 'Center page ID (omit for global graph)' },
            depth: { type: 'number', description: 'BFS expansion depth (default 2)', default: 2 },
          },
        },
      },
      {
        name: 'get_recent_pages',
        description: 'Get recently updated pages.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Max results (default 10)', default: 10 },
          },
        },
      },
    ],
  }));

  // Tool call handler
  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params as any;

    try {
      switch (name) {
        case 'search_pages': {
          const { query, limit = 20 } = args;
          const response = await apiClient.search(query, limit);
          const results = response.data.map((r: any) =>
            `**${r.title}** (score: ${r.score.toFixed(2)})\n${r.snippet}\nID: ${r.page_id}`
          ).join('\n\n');
          return {
            content: [{ type: 'text', text: `Found ${response.meta.total} results:\n\n${results}` }],
          };
        }

        case 'read_page': {
          const { id_or_title } = args;
          // Try as ID first, then search by title
          let response;
          try {
            response = await apiClient.readPage(id_or_title);
          } catch {
            // Search by title
            const searchResponse = await apiClient.search(id_or_title, 1);
            if (searchResponse.data.length === 0) {
              throw new Error(`Page not found: ${id_or_title}`);
            }
            response = await apiClient.readPage(searchResponse.data[0].page_id);
          }
          const page = response.data;
          return {
            content: [{
              type: 'text',
              text: `# ${page.title}\n\n${page.markdown}\n\n---\nID: ${page.id}\nUpdated: ${page.updated_at}`,
            }],
          };
        }

        case 'create_page': {
          const { title, markdown, parent_id } = args;
          const response = await apiClient.createPage(title, markdown, parent_id);
          return {
            content: [{
              type: 'text',
              text: `Created page: ${response.data.title}\nID: ${response.data.id}`,
            }],
          };
        }

        case 'update_page': {
          const { id, markdown } = args;
          const response = await apiClient.updatePage(id, markdown);
          return {
            content: [{
              type: 'text',
              text: `Updated page ${response.data.id} at ${response.data.updated_at}`,
            }],
          };
        }

        case 'list_pages': {
          const { parent_id, limit = 50 } = args;
          const response = await apiClient.listPages(parent_id, limit);
          const pageList = response.data.map((p: any) =>
            `- ${p.icon || '📄'} **${p.title}** (${p.id})`
          ).join('\n');
          return {
            content: [{
              type: 'text',
              text: `${response.meta.total} pages:\n\n${pageList}`,
            }],
          };
        }

        case 'get_graph': {
          const { page_id, depth = 2 } = args;
          const response = await apiClient.getGraph(page_id, depth);
          const graph = response.data;
          return {
            content: [{
              type: 'text',
              text: `Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges\n\nTop nodes by connections:\n` +
                graph.nodes
                  .sort((a: any, b: any) => b.link_count - a.link_count)
                  .slice(0, 10)
                  .map((n: any) => `- ${n.icon || '📄'} ${n.label} (${n.link_count} links)`)
                  .join('\n'),
            }],
          };
        }

        case 'get_recent_pages': {
          const { limit = 10 } = args;
          const response = await apiClient.listPages(undefined, limit);
          const pageList = response.data.map((p: any) =>
            `- ${p.icon || '📄'} **${p.title}**\n  Updated: ${p.updated_at}`
          ).join('\n\n');
          return {
            content: [{
              type: 'text',
              text: `Recent pages:\n\n${pageList}`,
            }],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true,
      };
    }
  });
}
```

---

### Step 5: Implement Resources

**File: `packages/mcp-server/src/resources/index.ts`**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { AgentClient } from '../api/client.js';

export function registerResources(server: Server, apiClient: AgentClient) {
  // List available resources
  server.setRequestHandler('resources/list', async () => ({
    resources: [
      {
        uri: 'pages://list',
        name: 'All Pages',
        description: 'List of all page titles and IDs',
        mimeType: 'text/plain',
      },
      {
        uri: 'pages://{id}',
        name: 'Page Content',
        description: 'Full markdown content for a specific page',
        mimeType: 'text/markdown',
      },
      {
        uri: 'graph://overview',
        name: 'Knowledge Graph',
        description: 'Overview of page connections',
        mimeType: 'application/json',
      },
    ],
  }));

  // Read resource
  server.setRequestHandler('resources/read', async (request) => {
    const { uri } = request.params as any;

    try {
      if (uri === 'pages://list') {
        const response = await apiClient.listPages(undefined, 1000);
        const content = response.data.map((p: any) =>
          `${p.id}\t${p.title}`
        ).join('\n');
        return {
          contents: [{
            uri,
            mimeType: 'text/plain',
            text: content,
          }],
        };
      }

      if (uri.startsWith('pages://')) {
        const id = uri.substring(8);
        const response = await apiClient.readPage(id);
        return {
          contents: [{
            uri,
            mimeType: 'text/markdown',
            text: `# ${response.data.title}\n\n${response.data.markdown}`,
          }],
        };
      }

      if (uri === 'graph://overview') {
        const response = await apiClient.getGraph();
        return {
          contents: [{
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(response.data, null, 2),
          }],
        };
      }

      throw new Error(`Unknown resource URI: ${uri}`);
    } catch (error: any) {
      throw new Error(`Failed to read resource: ${error.message}`);
    }
  });
}
```

---

### Step 6: Claude Desktop Configuration Guide

**File: `packages/mcp-server/README.md`**

```markdown
# SymbioKnowledgeBase MCP Server

Model Context Protocol server for integrating SymbioKnowledgeBase with Claude Desktop and other MCP clients.

## Installation

```bash
npm install -g @symbio/mcp-server
```

## Configuration

### Claude Desktop Setup

1. Open your Claude Desktop config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the MCP server:

```json
{
  "mcpServers": {
    "symbio-kb": {
      "command": "npx",
      "args": ["@symbio/mcp-server"],
      "env": {
        "SYMBIO_AUTH_TOKEN": "your-supabase-jwt-token-here",
        "SYMBIO_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

3. Restart Claude Desktop

## Usage

Once configured, you can use these tools in Claude:

- **search_pages**: Search knowledge base
  - Example: "Search for pages about machine learning"

- **read_page**: Read full page content
  - Example: "Read the page titled 'Project Roadmap'"

- **create_page**: Create new pages
  - Example: "Create a page called 'Meeting Notes' with today's discussion"

- **update_page**: Update existing pages
  - Example: "Update page X with this new content: ..."

- **list_pages**: Browse pages
  - Example: "List all pages in the 'Research' folder"

- **get_graph**: Explore connections
  - Example: "Show me how this page connects to others"

## Environment Variables

- `SYMBIO_AUTH_TOKEN` (required): Your Supabase JWT token
- `SYMBIO_API_URL` (optional): API base URL (default: http://localhost:3000)

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build
npm run build

# Run tests
npm test
```

## Troubleshooting

**Server not starting:**
- Check that `SYMBIO_AUTH_TOKEN` is set
- Verify SymbioKnowledgeBase is running on the configured URL

**Authentication errors:**
- Ensure your Supabase JWT token is valid
- Check that the token has access to your tenant

**No results from tools:**
- Verify your knowledge base has content
- Check the Claude Desktop logs for errors
```

---

## Testing Requirements

### Unit Tests

**File: `packages/mcp-server/__tests__/tools.test.ts`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createAgentClient } from '../src/api/client';

describe('MCP Tools', () => {
  it('search_pages calls Agent API correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ title: 'Test', page_id: '123' }], meta: { total: 1 } }),
    });
    global.fetch = mockFetch as any;

    const client = createAgentClient('http://localhost:3000', 'test-token');
    const result = await client.search('test query', 10);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/agent/search?q=test+query&limit=10&offset=0',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
    expect(result.data).toHaveLength(1);
  });

  it('read_page handles ID and title lookups', async () => {
    // Test implementation
  });
});
```

---

### Integration Tests

```bash
# Start MCP server
SYMBIO_AUTH_TOKEN=test-token npm run dev

# In another terminal, use MCP inspector
npx @modelcontextprotocol/inspector npx @symbio/mcp-server

# Verify:
# 1. Server lists 7 tools
# 2. search_pages tool returns results
# 3. read_page tool retrieves markdown
```

---

### E2E Tests

**Claude Desktop Integration Test:**

1. Configure Claude Desktop with test credentials
2. Ask Claude: "Search for pages about testing"
3. Verify: Claude uses `search_pages` tool and shows results
4. Ask Claude: "Create a new page called 'Test Page' with content 'Hello World'"
5. Verify: Page created in knowledge base
6. Ask Claude: "Read the page we just created"
7. Verify: Markdown content matches

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `packages/mcp-server/package.json` |
| CREATE | `packages/mcp-server/tsconfig.json` |
| CREATE | `packages/mcp-server/src/index.ts` |
| CREATE | `packages/mcp-server/src/api/client.ts` |
| CREATE | `packages/mcp-server/src/tools/index.ts` |
| CREATE | `packages/mcp-server/src/resources/index.ts` |
| CREATE | `packages/mcp-server/README.md` |
| CREATE | `packages/mcp-server/__tests__/tools.test.ts` |
| CREATE | `docs/guides/mcp-setup.md` |

---

## Dev Notes

### MCP Protocol Compliance
- Follow MCP spec v1.0 strictly
- Use official `@modelcontextprotocol/sdk` package
- Validate with MCP inspector tool

### Error Handling
- Return MCP-compliant error responses
- Log errors to stderr (not stdout, which is used for JSON-RPC)
- Include helpful error messages for debugging

### Performance
- Cache API responses for repeated queries (optional)
- Use streaming for large markdown content (future enhancement)

### Security
- Never log auth tokens
- Validate all tool inputs with Zod schemas
- Sanitize markdown output to prevent injection

### Future Enhancements (Post-MVP)
- HTTP/SSE transport for remote clients
- Websocket support for real-time updates
- Batch operations for multiple page updates
- Subscription to page change events

---

**Last Updated:** 2026-02-22

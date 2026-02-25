# Story SKB-31.6: Agent Filesystem API & MCP Tools

**Epic:** Epic 31 - Markdown Filesystem Mirror
**Story ID:** SKB-31.6
**Story Points:** 8 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-31.4 (filesystem must be fully synced both ways)

---

## User Story

As an AI agent, I want MCP tools that let me browse, read, write, search, and manipulate the Markdown filesystem mirror programmatically, So that I can interact with the knowledge base through the simplest and most natural interface -- files.

---

## Acceptance Criteria

### MCP Server
- [ ] An MCP server is implemented that exposes tools for filesystem operations
- [ ] Server runs as a stdio-based MCP server (compatible with Claude Code, Cursor, etc.)
- [ ] Server authenticates against the app (tenant isolation enforced)
- [ ] Server configuration: `MIRROR_DIR`, `TENANT_ID` (or auto-detect from env)
- [ ] Startup script: `npx tsx src/mcp/server.ts`

### MCP Tools

**Tool 1: `list_pages`**
- [ ] Lists all pages in the knowledge base as a directory tree
- [ ] Parameters: `{ path?: string, depth?: number, includeContent?: boolean }`
- [ ] Default: root level, depth 1, no content
- [ ] Returns: array of `{ path, title, icon, hasChildren, pageId }`
- [ ] Example: `list_pages({ path: "Projects", depth: 2 })`

**Tool 2: `read_page`**
- [ ] Reads a page's full Markdown content
- [ ] Parameters: `{ path: string }` (relative path like `Projects/Alpha.md`)
- [ ] Returns: `{ content: string, frontmatter: object, path: string }`
- [ ] Includes frontmatter metadata and full body

**Tool 3: `write_page`**
- [ ] Creates or updates a page by writing Markdown content
- [ ] Parameters: `{ path: string, content: string }`
- [ ] If the file exists: update (content includes frontmatter + body)
- [ ] If the file doesn't exist: create new page at that location
- [ ] The sync system handles DB propagation automatically
- [ ] Returns: `{ success: boolean, pageId: string, path: string }`

**Tool 4: `create_page`**
- [ ] Creates a new page with title and optional content
- [ ] Parameters: `{ title: string, parentPath?: string, content?: string, icon?: string }`
- [ ] Generates the `.md` file with proper frontmatter
- [ ] Places it in the correct folder based on parentPath
- [ ] Returns: `{ pageId: string, path: string }`

**Tool 5: `delete_page`**
- [ ] Deletes a page and its `.md` file
- [ ] Parameters: `{ path: string }`
- [ ] Confirms deletion returns `{ deleted: true, pageId: string }`
- [ ] Also deletes associated assets folder if empty

**Tool 6: `move_page`**
- [ ] Moves a page to a different parent
- [ ] Parameters: `{ sourcePath: string, destinationPath: string }`
- [ ] Handles folder promotion/demotion
- [ ] Returns: `{ success: boolean, newPath: string }`

**Tool 7: `search_pages`**
- [ ] Full-text search across all Markdown files
- [ ] Parameters: `{ query: string, path?: string, limit?: number }`
- [ ] Searches both frontmatter (title, tags) and body content
- [ ] Returns: array of `{ path, title, matchLine, matchContext }`
- [ ] Uses grep-style matching (fast, no DB dependency)

**Tool 8: `get_page_links`**
- [ ] Returns all wikilinks from and to a page
- [ ] Parameters: `{ path: string }`
- [ ] Returns: `{ outgoing: [{ title, path }], incoming: [{ title, path }] }`
- [ ] Outgoing: wikilinks found in the page content
- [ ] Incoming: pages that link TO this page (backlinks)

**Tool 9: `add_attachment`**
- [ ] Adds a file attachment to a page
- [ ] Parameters: `{ pagePath: string, filePath: string, fileName?: string }`
- [ ] Copies the file into the page's `assets/` folder
- [ ] Returns: `{ relativePath: string, markdownSyntax: string }`
- [ ] Example return: `{ relativePath: "./assets/image.png", markdownSyntax: "![](./assets/image.png)" }`

**Tool 10: `get_tree`**
- [ ] Returns the full page hierarchy as a nested tree
- [ ] Parameters: `{ includeMetadata?: boolean }`
- [ ] Returns: nested structure matching the sidebar tree
- [ ] Useful for agents to understand the full knowledge base structure

### Error Handling
- [ ] Tool failures return structured error: `{ error: string, code: string }`
- [ ] Invalid paths: "Page not found at path: Projects/Nonexistent.md"
- [ ] Permission errors: "Cannot access pages in another tenant"
- [ ] Write conflicts: "Page was modified externally, please retry"

### Agent Workflow Example
```
Agent: list_pages({ depth: 2 })
  -> [{ path: "Projects/_index.md", title: "Projects", hasChildren: true },
      { path: "Projects/Alpha.md", title: "Alpha", hasChildren: false },
      { path: "Welcome.md", title: "Welcome", hasChildren: false }]

Agent: read_page({ path: "Projects/Alpha.md" })
  -> { content: "---\ntitle: Alpha\n---\n\n# Alpha\n\nProject details...", ... }

Agent: write_page({ path: "Projects/Alpha.md", content: "---\ntitle: Alpha\n---\n\n# Alpha\n\nUpdated content with new section...\n\n## Timeline\n\n..." })
  -> { success: true, pageId: "uuid", path: "Projects/Alpha.md" }

Agent: create_page({ title: "Beta", parentPath: "Projects", content: "# Beta\n\nNew project..." })
  -> { pageId: "new-uuid", path: "Projects/Beta.md" }

Agent: search_pages({ query: "architecture diagram" })
  -> [{ path: "Projects/Alpha.md", title: "Alpha", matchLine: 15, matchContext: "...see the architecture diagram below..." }]
```

---

## Architecture Overview

```
MCP Server Architecture:
------------------------

Claude Code / Cursor / Agent
        |
        | MCP Protocol (stdio)
        v
+---------------------------+
|   MCP Server              |
|   src/mcp/server.ts       |
|                           |
|   Tools:                  |
|   - list_pages            |
|   - read_page             |
|   - write_page            |
|   - create_page           |
|   - delete_page           |
|   - move_page             |
|   - search_pages          |
|   - get_page_links        |
|   - add_attachment        |
|   - get_tree              |
+---------------------------+
        |
        | File I/O (direct)
        v
+---------------------------+
|   Filesystem Mirror       |
|   data/mirror/{tenant}/   |
|                           |
|   .md files + assets/     |
+---------------------------+
        |
        | Bidirectional sync (SKB-31.3/31.4)
        v
+---------------------------+
|   PostgreSQL Database     |
|   Block.content (Json)    |
+---------------------------+
        |
        v
+---------------------------+
|   Browser Editor          |
|   (TipTap/React)          |
+---------------------------+
```

---

## Implementation Steps

### Step 1: Create MCP Server Scaffold

**File: `src/mcp/server.ts`** (create)

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "symbio-knowledge-base",
  version: "1.0.0",
}, {
  capabilities: { tools: {} },
});

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "list_pages", description: "List pages in the knowledge base", inputSchema: { ... } },
    { name: "read_page", description: "Read a page's Markdown content", inputSchema: { ... } },
    // ... all 10 tools
  ],
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "list_pages": return handleListPages(request.params.arguments);
    case "read_page": return handleReadPage(request.params.arguments);
    // ...
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Step 2: Implement Each Tool Handler

**File: `src/mcp/tools/listPages.ts`** through `src/mcp/tools/getTree.ts`

Each tool reads/writes the filesystem mirror directly. The sync system handles DB propagation.

### Step 3: Add MCP SDK Dependency

```bash
npm install @modelcontextprotocol/sdk
```

### Step 4: Create MCP Configuration

**File: `mcp-config.json`** (create)

```json
{
  "mcpServers": {
    "symbio-knowledge-base": {
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"],
      "env": {
        "MIRROR_DIR": "data/mirror",
        "TENANT_ID": "default-tenant-id"
      }
    }
  }
}
```

---

## Testing Requirements

### Unit Tests (12+ cases)

- list_pages returns correct directory listing
- list_pages with depth parameter limits nesting
- read_page returns content and frontmatter
- read_page for non-existent path returns error
- write_page updates existing file
- write_page creates new file
- create_page generates correct path and frontmatter
- delete_page removes file
- search_pages finds matching content
- get_page_links returns outgoing and incoming links
- add_attachment copies file to assets folder
- get_tree returns nested hierarchy

### Integration Tests (6+ cases)

- create_page via MCP -> page appears in DB -> visible in browser
- write_page via MCP -> block content updated in DB
- delete_page via MCP -> page removed from DB
- search_pages finds content written via browser
- Full round-trip: browser edit -> read_page reflects change
- Tenant isolation: cannot access other tenant's files

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/mcp/server.ts` | Create | MCP server entry point |
| `src/mcp/tools/listPages.ts` | Create | list_pages tool |
| `src/mcp/tools/readPage.ts` | Create | read_page tool |
| `src/mcp/tools/writePage.ts` | Create | write_page tool |
| `src/mcp/tools/createPage.ts` | Create | create_page tool |
| `src/mcp/tools/deletePage.ts` | Create | delete_page tool |
| `src/mcp/tools/movePage.ts` | Create | move_page tool |
| `src/mcp/tools/searchPages.ts` | Create | search_pages tool |
| `src/mcp/tools/getPageLinks.ts` | Create | get_page_links tool |
| `src/mcp/tools/addAttachment.ts` | Create | add_attachment tool |
| `src/mcp/tools/getTree.ts` | Create | get_tree tool |
| `mcp-config.json` | Create | MCP server configuration |
| `package.json` | Modify | Add @modelcontextprotocol/sdk |
| Tests | Create | Unit and integration tests |

---

**Last Updated:** 2026-02-25

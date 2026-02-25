# MCP Server Quick Start

Connect Claude Desktop or Claude Code to your SymbioKnowledgeBase instance using the Model Context Protocol (MCP).

## Prerequisites

- Node.js 18+
- A running SymbioKnowledgeBase instance (default: `http://localhost:3000`)
- An API key (generate one in Settings > API Keys)

## 1. Build the MCP Server

```bash
cd packages/mcp-server
npm install
npm run build
```

## 2. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "symbio-knowledge-base": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "SYMBIO_AUTH_TOKEN": "skb_live_your_api_key_here",
        "SYMBIO_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

**Config file locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`

## 3. Configure Claude Code

Add to your `.claude/settings.json`:

```json
{
  "mcpServers": {
    "symbio-knowledge-base": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "SYMBIO_AUTH_TOKEN": "skb_live_your_api_key_here",
        "SYMBIO_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

## 4. Available Tools

| Tool | Description |
|------|-------------|
| `search_pages(query)` | Search pages by keyword |
| `read_page(id_or_title)` | Read a page's markdown content |
| `create_page(title, markdown?)` | Create a new page |
| `update_page(id, markdown)` | Update page content |
| `list_pages(parent_id?)` | List pages (optionally filtered by parent) |
| `get_graph(page_id?, depth?)` | Get knowledge graph |
| `get_recent_pages(limit?)` | Get recently updated pages |

## 5. Available Resources

| URI | Description |
|-----|-------------|
| `pages://list` | All page titles with IDs |
| `pages://{id}` | Full markdown content for a page |
| `graph://overview` | Knowledge graph summary |

## 6. Test It

After configuring, try asking Claude:

> "Search my knowledge base for system architecture"

> "Read the API Reference page"

> "Create a new page called 'Meeting Notes' with today's meeting summary"

## Troubleshooting

**"SYMBIO_AUTH_TOKEN environment variable is required"**
- Ensure you set the `SYMBIO_AUTH_TOKEN` in your MCP config env block.

**"Connection refused" errors**
- Make sure SymbioKnowledgeBase is running at the URL specified in `SYMBIO_API_URL`.
- Default is `http://localhost:3000`.

**"API Error (401): Invalid authentication"**
- Check that your API key is correct and hasn't been revoked.
- API keys start with `skb_`.

**No response from MCP server**
- Check that the server builds successfully: `cd packages/mcp-server && npm run build`
- Verify the path in your config points to `dist/index.js` (not `src/index.ts`)
- Check stderr logs for error messages

**Debug mode**
- The MCP server logs to stderr. Run manually to see debug output:
  ```bash
  SYMBIO_AUTH_TOKEN=your_key node packages/mcp-server/dist/index.js
  ```

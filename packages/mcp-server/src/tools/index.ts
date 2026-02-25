import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type {
  AgentClient,
  BacklinkEntry,
  DatabaseDetail,
  GraphNode,
} from "../api/client.js";

export function registerTools(server: Server, apiClient: AgentClient) {
  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "search_pages",
        description:
          "Search knowledge base pages by query string. Returns page titles, snippets, and relevance scores.",
        inputSchema: {
          type: "object" as const,
          properties: {
            query: { type: "string", description: "Search query" },
            limit: {
              type: "number",
              description: "Max results (default 20)",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "read_page",
        description:
          "Read a page by ID or title. Returns full markdown content and metadata.",
        inputSchema: {
          type: "object" as const,
          properties: {
            id_or_title: {
              type: "string",
              description: "Page ID (UUID) or exact title",
            },
          },
          required: ["id_or_title"],
        },
      },
      {
        name: "create_page",
        description:
          "Create a new knowledge base page with optional markdown content.",
        inputSchema: {
          type: "object" as const,
          properties: {
            title: { type: "string", description: "Page title" },
            markdown: {
              type: "string",
              description: "Page content in markdown format",
            },
            parent_id: {
              type: "string",
              description: "Parent page ID (for nested pages)",
            },
          },
          required: ["title"],
        },
      },
      {
        name: "update_page",
        description: "Update a page's markdown content by ID.",
        inputSchema: {
          type: "object" as const,
          properties: {
            id: { type: "string", description: "Page ID (UUID)" },
            markdown: {
              type: "string",
              description: "New markdown content",
            },
          },
          required: ["id", "markdown"],
        },
      },
      {
        name: "list_pages",
        description: "List all pages or filter by parent folder.",
        inputSchema: {
          type: "object" as const,
          properties: {
            parent_id: {
              type: "string",
              description: "Parent page ID (omit for all pages)",
            },
            limit: {
              type: "number",
              description: "Max results (default 50)",
            },
          },
        },
      },
      {
        name: "get_graph",
        description:
          "Get knowledge graph with nodes and edges. Optional: center on specific page.",
        inputSchema: {
          type: "object" as const,
          properties: {
            page_id: {
              type: "string",
              description: "Center page ID (omit for global graph)",
            },
            depth: {
              type: "number",
              description: "BFS expansion depth (default 2)",
            },
          },
        },
      },
      {
        name: "get_recent_pages",
        description: "Get recently updated pages.",
        inputSchema: {
          type: "object" as const,
          properties: {
            limit: {
              type: "number",
              description: "Max results (default 10)",
            },
          },
        },
      },
      {
        name: "delete_page",
        description:
          "Delete a page by ID. Removes associated blocks and links. Child pages become orphans.",
        inputSchema: {
          type: "object" as const,
          properties: {
            id: { type: "string", description: "Page ID (UUID) to delete" },
          },
          required: ["id"],
        },
      },
      {
        name: "get_backlinks",
        description:
          "Get all pages that link TO a given page. Accepts page ID or title.",
        inputSchema: {
          type: "object" as const,
          properties: {
            id_or_title: {
              type: "string",
              description: "Page ID (UUID) or exact title",
            },
          },
          required: ["id_or_title"],
        },
      },
      {
        name: "list_databases",
        description:
          "List all databases (structured tables) in the knowledge base.",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "read_database",
        description:
          "Get a database's schema (column definitions) and metadata.",
        inputSchema: {
          type: "object" as const,
          properties: {
            id: {
              type: "string",
              description: "Database ID (UUID)",
            },
          },
          required: ["id"],
        },
      },
      {
        name: "query_rows",
        description: "Query rows from a database with optional pagination.",
        inputSchema: {
          type: "object" as const,
          properties: {
            database_id: {
              type: "string",
              description: "Database ID (UUID)",
            },
            limit: {
              type: "number",
              description: "Max rows to return (default 50)",
            },
          },
          required: ["database_id"],
        },
      },
      {
        name: "create_row",
        description:
          "Create a new row in a database. Properties must match the database schema.",
        inputSchema: {
          type: "object" as const,
          properties: {
            database_id: {
              type: "string",
              description: "Database ID (UUID)",
            },
            properties: {
              type: "object",
              description:
                'Row properties as { column_id: { type, value } }. E.g. { "col-title": { "type": "TITLE", "value": "Bug fix" } }',
            },
          },
          required: ["database_id", "properties"],
        },
      },
      {
        name: "update_row",
        description:
          "Update a row's properties (partial merge with existing values).",
        inputSchema: {
          type: "object" as const,
          properties: {
            database_id: {
              type: "string",
              description: "Database ID (UUID)",
            },
            row_id: {
              type: "string",
              description: "Row ID (UUID)",
            },
            properties: {
              type: "object",
              description: "Properties to update (partial)",
            },
          },
          required: ["database_id", "row_id", "properties"],
        },
      },
      {
        name: "delete_row",
        description: "Delete a row from a database.",
        inputSchema: {
          type: "object" as const,
          properties: {
            database_id: {
              type: "string",
              description: "Database ID (UUID)",
            },
            row_id: {
              type: "string",
              description: "Row ID (UUID)",
            },
          },
          required: ["database_id", "row_id"],
        },
      },
    ],
  }));

  // Tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = (args ?? {}) as Record<string, unknown>;

    try {
      switch (name) {
        case "search_pages": {
          const query = toolArgs.query as string;
          const limit = (toolArgs.limit as number) ?? 20;
          const response = await apiClient.search(query, limit);
          const results = response.data
            .map(
              (r) =>
                `**${r.title}** (score: ${r.score.toFixed(2)})\n${r.snippet}\nID: ${r.page_id}`
            )
            .join("\n\n");
          return {
            content: [
              {
                type: "text" as const,
                text: `Found ${response.meta.total} results:\n\n${results}`,
              },
            ],
          };
        }

        case "read_page": {
          const idOrTitle = toolArgs.id_or_title as string;
          let response;
          try {
            response = await apiClient.readPage(idOrTitle);
          } catch {
            // Search by title
            const searchResponse = await apiClient.search(idOrTitle, 1);
            if (searchResponse.data.length === 0) {
              throw new Error(`Page not found: ${idOrTitle}`);
            }
            response = await apiClient.readPage(
              searchResponse.data[0].page_id
            );
          }
          const page = response.data;
          return {
            content: [
              {
                type: "text" as const,
                text: `# ${page.title}\n\n${page.markdown}\n\n---\nID: ${page.id}\nUpdated: ${page.updated_at}`,
              },
            ],
          };
        }

        case "create_page": {
          const title = toolArgs.title as string;
          const markdown = toolArgs.markdown as string | undefined;
          const parentId = toolArgs.parent_id as string | undefined;
          const response = await apiClient.createPage(
            title,
            markdown,
            parentId
          );
          return {
            content: [
              {
                type: "text" as const,
                text: `Created page: ${response.data.title}\nID: ${response.data.id}`,
              },
            ],
          };
        }

        case "update_page": {
          const id = toolArgs.id as string;
          const markdown = toolArgs.markdown as string;
          const response = await apiClient.updatePage(id, markdown);
          return {
            content: [
              {
                type: "text" as const,
                text: `Updated page ${response.data.id} at ${response.data.updated_at}`,
              },
            ],
          };
        }

        case "list_pages": {
          const parentId = toolArgs.parent_id as string | undefined;
          const limit = (toolArgs.limit as number) ?? 50;
          const response = await apiClient.listPages(parentId, limit);
          const pageList = response.data
            .map((p) => `- ${p.icon || "\u{1F4C4}"} **${p.title}** (${p.id})`)
            .join("\n");
          return {
            content: [
              {
                type: "text" as const,
                text: `${response.meta.total} pages:\n\n${pageList}`,
              },
            ],
          };
        }

        case "get_graph": {
          const pageId = toolArgs.page_id as string | undefined;
          const depth = (toolArgs.depth as number) ?? 2;
          const response = await apiClient.getGraph(pageId, depth);
          const graph = response.data;
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges\n\nTop nodes by connections:\n` +
                  graph.nodes
                    .sort(
                      (a: GraphNode, b: GraphNode) =>
                        b.link_count - a.link_count
                    )
                    .slice(0, 10)
                    .map(
                      (n: GraphNode) =>
                        `- ${n.icon || "\u{1F4C4}"} ${n.label} (${n.link_count} links)`
                    )
                    .join("\n"),
              },
            ],
          };
        }

        case "get_recent_pages": {
          const limit = (toolArgs.limit as number) ?? 10;
          const response = await apiClient.listPages(undefined, limit);
          const pageList = response.data
            .map(
              (p) =>
                `- ${p.icon || "\u{1F4C4}"} **${p.title}**\n  Updated: ${p.updated_at}`
            )
            .join("\n\n");
          return {
            content: [
              {
                type: "text" as const,
                text: `Recent pages:\n\n${pageList}`,
              },
            ],
          };
        }

        case "delete_page": {
          const id = toolArgs.id as string;
          const response = await apiClient.deletePage(id);
          return {
            content: [
              {
                type: "text" as const,
                text: `Deleted page ${response.data.id} at ${response.data.deleted_at}`,
              },
            ],
          };
        }

        case "get_backlinks": {
          const idOrTitle = toolArgs.id_or_title as string;
          let pageId = idOrTitle;

          // If not a UUID, resolve via search
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(idOrTitle)) {
            const searchResponse = await apiClient.search(idOrTitle, 1);
            if (searchResponse.data.length === 0) {
              throw new Error(`Page not found: ${idOrTitle}`);
            }
            pageId = searchResponse.data[0].page_id;
          }

          const response = await apiClient.getBacklinks(pageId);
          const backlinks = response.data as BacklinkEntry[];
          if (backlinks.length === 0) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: "No backlinks found for this page.",
                },
              ],
            };
          }
          const list = backlinks
            .map(
              (b: BacklinkEntry) =>
                `- ${b.icon || "\u{1F4C4}"} **${b.title}** (${b.id})`
            )
            .join("\n");
          return {
            content: [
              {
                type: "text" as const,
                text: `${backlinks.length} pages link to this page:\n\n${list}`,
              },
            ],
          };
        }

        case "list_databases": {
          const response = await apiClient.listDatabases();
          if (response.data.length === 0) {
            return {
              content: [
                { type: "text" as const, text: "No databases found." },
              ],
            };
          }
          const dbList = response.data
            .map(
              (db) =>
                `- **${db.title}** (${db.id})\n  ${db.column_count} columns, ${db.row_count} rows`
            )
            .join("\n\n");
          return {
            content: [
              {
                type: "text" as const,
                text: `${response.meta.total} databases:\n\n${dbList}`,
              },
            ],
          };
        }

        case "read_database": {
          const dbId = toolArgs.id as string;
          const response = await apiClient.readDatabase(dbId);
          const db = response.data as DatabaseDetail;
          const columns = db.schema.columns
            .map(
              (c) =>
                `  - **${c.name}** (${c.type})${c.options ? ` [${c.options.join(", ")}]` : ""}`
            )
            .join("\n");
          return {
            content: [
              {
                type: "text" as const,
                text: `Database: **${db.title}** (${db.id})\n${db.row_count} rows\n\nColumns:\n${columns}`,
              },
            ],
          };
        }

        case "query_rows": {
          const dbId = toolArgs.database_id as string;
          const rowLimit = (toolArgs.limit as number) ?? 50;
          const response = await apiClient.queryRows(dbId, rowLimit);
          if (response.data.length === 0) {
            return {
              content: [
                { type: "text" as const, text: "No rows found." },
              ],
            };
          }
          const rowList = response.data
            .map(
              (r) =>
                `Row ${r.id}:\n${JSON.stringify(r.properties, null, 2)}`
            )
            .join("\n\n");
          return {
            content: [
              {
                type: "text" as const,
                text: `${response.meta.total} rows (showing ${response.data.length}):\n\n${rowList}`,
              },
            ],
          };
        }

        case "create_row": {
          const dbId = toolArgs.database_id as string;
          const properties = toolArgs.properties as Record<string, unknown>;
          const response = await apiClient.createRow(dbId, properties);
          return {
            content: [
              {
                type: "text" as const,
                text: `Created row ${response.data.id} in database ${dbId}`,
              },
            ],
          };
        }

        case "update_row": {
          const dbId = toolArgs.database_id as string;
          const rowId = toolArgs.row_id as string;
          const properties = toolArgs.properties as Record<string, unknown>;
          const response = await apiClient.updateRow(dbId, rowId, properties);
          return {
            content: [
              {
                type: "text" as const,
                text: `Updated row ${response.data.id} at ${response.data.updated_at}`,
              },
            ],
          };
        }

        case "delete_row": {
          const dbId = toolArgs.database_id as string;
          const rowId = toolArgs.row_id as string;
          const response = await apiClient.deleteRow(dbId, rowId);
          return {
            content: [
              {
                type: "text" as const,
                text: `Deleted row ${response.data.id} at ${response.data.deleted_at}`,
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });
}

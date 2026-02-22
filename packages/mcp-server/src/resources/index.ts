import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { AgentClient } from "../api/client.js";

export function registerResources(server: Server, apiClient: AgentClient) {
  // List available resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: "pages://list",
        name: "All Pages",
        description: "List of all page titles and IDs",
        mimeType: "text/plain",
      },
      {
        uri: "graph://overview",
        name: "Knowledge Graph",
        description: "Overview of page connections",
        mimeType: "application/json",
      },
    ],
  }));

  // Read resource
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      if (uri === "pages://list") {
        const response = await apiClient.listPages(undefined, 1000);
        const content = response.data
          .map((p) => `${p.id}\t${p.title}`)
          .join("\n");
        return {
          contents: [
            {
              uri,
              mimeType: "text/plain",
              text: content,
            },
          ],
        };
      }

      if (uri.startsWith("pages://")) {
        const id = uri.substring(8);
        const response = await apiClient.readPage(id);
        return {
          contents: [
            {
              uri,
              mimeType: "text/markdown",
              text: `# ${response.data.title}\n\n${response.data.markdown}`,
            },
          ],
        };
      }

      if (uri === "graph://overview") {
        const response = await apiClient.getGraph();
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(response.data, null, 2),
            },
          ],
        };
      }

      throw new Error(`Unknown resource URI: ${uri}`);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`Failed to read resource: ${message}`);
    }
  });
}

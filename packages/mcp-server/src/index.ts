#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { registerResources } from "./resources/index.js";
import { createAgentClient } from "./api/client.js";

async function main() {
  // Validate environment
  const authToken = process.env.SYMBIO_AUTH_TOKEN;
  const apiUrl = process.env.SYMBIO_API_URL || "http://localhost:3000";

  if (!authToken) {
    console.error(
      "Error: SYMBIO_AUTH_TOKEN environment variable is required"
    );
    process.exit(1);
  }

  // Create MCP server
  const server = new Server(
    {
      name: "symbio-knowledge-base",
      version: "1.0.0",
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
    console.error("[MCP Error]", error);
  };

  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  // Connect transport (stdio for Claude Desktop)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("SymbioKnowledgeBase MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

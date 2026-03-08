import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { toolDefinitions, handleToolCall } from "./tools.js";
import { logger } from "../utils/logger.js";

export function createServer(): Server {
  const server = new Server(
    {
      name: "oneclicklm",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug("Listing tools");
    return {
      tools: toolDefinitions,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info(`Tool call: ${name}`);
    return handleToolCall(name, (args ?? {}) as Record<string, unknown>);
  });

  return server;
}

export async function startServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  logger.info("Starting OneClickLM MCP server...");

  await server.connect(transport);

  logger.info("OneClickLM MCP server is running (stdio transport)");
}

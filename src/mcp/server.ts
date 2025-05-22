// src/mcp/server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ZodRawShape } from 'zod';
import { config } from '../config/index.js';
import { IndexManager } from '../core/indexing/indexManager.js';
import { SearchService } from '../core/search/SearchService.js';
import { createAllMcpTools } from './tools/index.js';

type McpToolExecuteResult = Promise<{
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}>;

export async function startMcpServer(): Promise<void> {
  // Log server start to stderr
  console.error('Starting Bucketeer Documentation MCP Server...');

  const indexManager = new IndexManager();
  const indexLoaded = await indexManager.loadIndex();

  if (!indexLoaded) {
    console.error(
      `Document index not found or failed to load from ${config.indexDir}.`
    );
    console.error(
      'Please run "npm run build:index" to create the index before starting the server.'
    );
    process.exit(1);
  }

  const searchService = new SearchService(indexManager);
  console.error('Search service initialized.');

  const server = new McpServer({
    name: 'bucketeer-docs',
    version: '1.0.0',
    capabilities: {
      tools: { listChanged: false },
    },
  });

  const mcpTools = createAllMcpTools(searchService);

  server.tool(
    mcpTools.searchTool.name,
    mcpTools.searchTool.description,
    mcpTools.searchTool.inputSchema.shape as ZodRawShape,
    (args: Record<string, unknown>): McpToolExecuteResult => {
      return mcpTools.searchTool.execute(
        args as { query: string; limit?: number }
      );
    }
  );
  console.error(`Registered MCP tool: ${mcpTools.searchTool.name}`);

  server.tool(
    mcpTools.getDocumentTool.name,
    mcpTools.getDocumentTool.description,
    mcpTools.getDocumentTool.inputSchema.shape as ZodRawShape,
    (args: Record<string, unknown>): McpToolExecuteResult => {
      return mcpTools.getDocumentTool.execute(args as { path: string });
    }
  );
  console.error(`Registered MCP tool: ${mcpTools.getDocumentTool.name}`);

  const transport = new StdioServerTransport();
  try {
    console.error('Attempting to connect transport...');
    await server.connect(transport);
    console.error(
      'MCP server transport connected successfully via stdio. Ready for requests.'
    );
  } catch (error) {
    console.error('Failed to connect MCP server transport:', error);
    process.exit(1);
  }

  process.on('SIGINT', async () => {
    console.error('\nReceived SIGINT, shutting down MCP server...');
    await server.close();
    console.error('MCP server closed.');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.error('\nReceived SIGTERM, shutting down MCP server...');
    await server.close();
    console.error('MCP server closed.');
    process.exit(0);
  });

  process.on('uncaughtException', (error, origin) => {
    console.error(`Uncaught Exception at: ${origin}`, error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}

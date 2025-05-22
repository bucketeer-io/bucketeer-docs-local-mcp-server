import { z } from 'zod';
import { config } from '../../config/index.js';
import type { SearchService } from '../../core/search/SearchService.js';

type McpTextContent = { type: 'text'; text: string };

export function createSearchTool(searchService: SearchService) {
  return {
    name: 'search-docs',
    description: 'Search for relevant documents in the documentation.',
    inputSchema: z.object({
      query: z.string().describe('The search query.'),
      limit: z
        .number()
        .optional()
        .default(config.searchLimitDefault)
        .describe('Maximum number of results to return.'),
    }),
    execute: async ({ query, limit }: { query: string; limit?: number }) => {
      try {
        console.error(
          `[MCP Tool] Received search-docs request: "${query}" (limit: ${limit})`
        );
        const results = await searchService.search(
          query,
          limit || config.searchLimitDefault
        );
        const responseContent: McpTextContent = {
          type: 'text' as const,
          text: JSON.stringify(results, null, 2),
        };
        return { content: [responseContent] };
      } catch (error) {
        console.error(
          `[MCP Tool] Error processing search-docs request for "${query}":`,
          error
        );
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorContent: McpTextContent = {
          type: 'text' as const,
          text: JSON.stringify({ error: `Search failed: ${errorMessage}` }),
        };
        return { content: [errorContent], isError: true };
      }
    },
  };
}

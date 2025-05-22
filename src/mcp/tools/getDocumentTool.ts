import { z } from 'zod';
import { SearchService } from '../../core/search/SearchService.js';

type McpTextContent = { type: 'text'; text: string };

export function createGetDocumentTool(searchService: SearchService) {
  return {
    name: 'get-document',
    description:
      'Retrieve the full content of a specific document by its path.',
    inputSchema: z.object({
      path: z.string().describe('The path of the document to retrieve.'),
    }),
    execute: async ({ path }: { path: string }) => {
      try {
        console.error(
          `[MCP Tool] Received get-document request for path: "${path}"`
        );
        const document = searchService.getDocument(path);

        if (!document) {
          const errorContent: McpTextContent = {
            type: 'text' as const,
            text: JSON.stringify({ error: `Document not found: ${path}` }),
          };
          return { content: [errorContent], isError: true };
        }

        const responseContent: McpTextContent = {
          type: 'text' as const,
          text: JSON.stringify(document, null, 2),
        };
        return { content: [responseContent] };
      } catch (error) {
        console.error(
          `[MCP Tool] Error processing get-document request for path "${path}":`,
          error
        );
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const errorContent: McpTextContent = {
          type: 'text' as const,
          text: JSON.stringify({
            error: `Failed to get document: ${errorMessage}`,
          }),
        };
        return { content: [errorContent], isError: true };
      }
    },
  };
}

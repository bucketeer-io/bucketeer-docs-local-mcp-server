import { SearchService } from '../../core/search/SearchService.js';
import { createGetDocumentTool } from './getDocumentTool.js';
import { createSearchTool } from './searchTool.js';

// Function to create all tools, injecting dependencies
export function createAllMcpTools(searchService: SearchService) {
  return {
    searchTool: createSearchTool(searchService),
    getDocumentTool: createGetDocumentTool(searchService),
  };
}

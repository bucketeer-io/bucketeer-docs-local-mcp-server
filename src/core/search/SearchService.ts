import { config } from '../../config/index.js';
import type { IndexManager } from '../indexing/indexManager.js';
import type { DocumentContent, SearchResult } from '../indexing/types.js';

export class SearchService {
  private indexManager: IndexManager;

  constructor(indexManager: IndexManager) {
    if (!indexManager.isIndexLoaded()) {
      throw new Error('SearchService requires a loaded IndexManager');
    }
    this.indexManager = indexManager;
  }

  /**
   * Performs a search for documents matching the query
   */
  public async search(
    query: string,
    limit: number = config.searchLimitDefault
  ): Promise<SearchResult[]> {
    try {
      console.error(`Performing search for: "${query}" (limit=${limit})`);
      const results = this.indexManager.search(query, limit);
      console.error(`Found ${results.length} results for query.`);
      return results;
    } catch (error) {
      console.error(`Error during search for "${query}":`, error);
      throw error;
    }
  }

  /**
   * Gets a document by path
   */
  public getDocument(path: string): DocumentContent | null {
    try {
      return this.indexManager.getDocument(path);
    } catch (error) {
      console.error(`Error getting document for path "${path}":`, error);
      return null;
    }
  }
}

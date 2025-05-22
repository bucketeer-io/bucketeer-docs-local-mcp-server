import * as path from 'path';
import { config } from '../../config/index.js';
import {
  ensureDirectoryExists,
  fileExists,
  listFiles,
  readFile,
  writeFile,
} from '../../utils/fileUtils.js';
import { extractKeywords } from '../../utils/helpers.js';
import { DocumentContent, DocumentIndex, SearchResult } from './types.js';

export class IndexManager {
  private readonly indexDirectory: string = config.indexDir;
  private readonly indexFile: string = path.join(
    config.indexDir,
    'document-index.json'
  );
  private index: DocumentIndex | null = null;

  /**
   * Builds the document index from the given documents directory
   */
  public async buildIndex(documentsDir: string): Promise<void> {
    console.error(`Building document index from: ${documentsDir}`);
    const jsonFiles = await listFiles(documentsDir, '.json');
    const filesToSkip = [
      'summary.json',
      'github_cache.json',
      'lastmod_cache.json',
    ];

    // Initialize index
    const index: DocumentIndex = {
      documents: {},
      keywords: {},
    };

    // Process each document
    let processedCount = 0;
    for (const file of jsonFiles) {
      if (filesToSkip.includes(file)) {
        continue;
      }

      const filePath = path.join(documentsDir, file);
      try {
        const fileContent = await readFile(filePath);
        const document = JSON.parse(fileContent) as DocumentContent;

        // Add document to index
        const documentPath = document.path;
        index.documents[documentPath] = document;

        // Build keywords from Markdown content
        // Extract keywords from title, description, and headers in content
        const keywords = new Set<string>();

        // Add words from title and description
        for (const kw of extractKeywords(
          `${document.title} ${document.description}`
        )) {
          keywords.add(kw.toLowerCase());
        }

        // Extract headers from Markdown content
        const headerMatches = document.content.match(/#{1,6}\s+(.+)$/gm);
        if (headerMatches) {
          for (const header of headerMatches) {
            const headerText = header.replace(/^#{1,6}\s+/, '');
            for (const kw of extractKeywords(headerText)) {
              keywords.add(kw.toLowerCase());
            }
          }
        }

        // Add content-based keywords
        for (const kw of extractKeywords(document.content)) {
          keywords.add(kw.toLowerCase());
        }

        // Index the keywords
        const docId = documentPath;
        for (const keyword of Array.from(keywords)) {
          if (!index.keywords[keyword]) {
            index.keywords[keyword] = [];
          }
          index.keywords[keyword].push(docId);
        }

        processedCount++;
        if (processedCount % 10 === 0) {
          console.error(`Processed ${processedCount} documents`);
        }
      } catch (error) {
        console.error(`Error processing document ${file}:`, error);
      }
    }

    // Save index
    await this.saveIndex(index);
    console.error(`Index built with ${processedCount} documents.`);
    this.index = index;
  }

  /**
   * Loads the index from disk
   */
  public async loadIndex(): Promise<boolean> {
    console.error(`Loading document index from: ${this.indexFile}`);
    try {
      if (!(await fileExists(this.indexFile))) {
        console.error(`Index file not found: ${this.indexFile}`);
        return false;
      }

      const content = await readFile(this.indexFile);
      this.index = JSON.parse(content) as DocumentIndex;
      console.error(
        `Index loaded with ${
          Object.keys(this.index.documents).length
        } documents.`
      );
      return true;
    } catch (error) {
      console.error('Error loading index:', error);
      this.index = null;
      return false;
    }
  }

  /**
   * Saves the index to disk
   */
  private async saveIndex(index: DocumentIndex): Promise<void> {
    try {
      await ensureDirectoryExists(this.indexDirectory);
      await writeFile(this.indexFile, JSON.stringify(index, null, 2));
      console.error(`Index saved to: ${this.indexFile}`);
    } catch (error) {
      console.error('Error saving index:', error);
      throw error;
    }
  }

  /**
   * Checks if the index is loaded
   */
  public isIndexLoaded(): boolean {
    return this.index !== null;
  }

  /**
   * Gets a document by path
   */
  public getDocument(path: string): DocumentContent | null {
    if (!this.index) {
      throw new Error('Index not loaded');
    }

    return this.index.documents[path] || null;
  }

  /**
   * Searches the index for documents matching query
   */
  public search(
    query: string,
    limit: number = config.searchLimitDefault
  ): SearchResult[] {
    if (!this.index) {
      throw new Error('Index not loaded');
    }

    // Extract search terms
    const searchTerms = extractKeywords(query);
    if (searchTerms.length === 0) {
      return [];
    }

    // Simple scoring function based on keyword matches and content relevance
    const scores: Record<string, number> = {};

    // Score by keyword matches
    for (const term of searchTerms) {
      const normalizedTerm = term.toLowerCase();
      const matchingPaths = this.index?.keywords[normalizedTerm] || [];
      for (const path of matchingPaths) {
        scores[path] = (scores[path] || 0) + 1;
      }
    }

    // Add full text search for documents that didn't match by keywords
    if (Object.keys(scores).length < limit * 2) {
      for (const [path, doc] of Object.entries(this.index?.documents || {})) {
        if (!scores[path]) {
          // Simple text search
          const contentLower = doc.content.toLowerCase();
          const titleLower = doc.title.toLowerCase();

          let score = 0;
          for (const term of searchTerms) {
            const normalizedTerm = term.toLowerCase();
            // Count occurrences and weight by field
            const titleCount = (
              titleLower.match(new RegExp(normalizedTerm, 'g')) || []
            ).length;
            const contentCount = (
              contentLower.match(new RegExp(normalizedTerm, 'g')) || []
            ).length;

            score += titleCount * 3 + contentCount * 1;
          }

          if (score > 0) {
            scores[path] = score;
          }
        }
      }
    }

    // Sort by score
    const results = Object.entries(scores)
      .map(([path, score]) => {
        const doc = this.index?.documents[path];
        if (!doc) {
          return null;
        }
        const content = doc.content;

        // Find a relevant excerpt
        let excerpt = '';
        if (content) {
          // Find first occurrence of any search term
          const contentLower = content.toLowerCase();
          let firstIndex = -1;
          for (const term of searchTerms) {
            const normalizedTerm = term.toLowerCase();
            const index = contentLower.indexOf(normalizedTerm);
            if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
              firstIndex = index;
            }
          }

          // Create excerpt
          if (firstIndex !== -1) {
            const start = Math.max(0, firstIndex - 50);
            const end = Math.min(content.length, firstIndex + 150);
            excerpt = content.substring(start, end).trim();
            excerpt =
              (start > 0 ? '...' : '') +
              excerpt +
              (end < content.length ? '...' : '');
          } else {
            excerpt =
              content.substring(0, 200) + (content.length > 200 ? '...' : '');
          }
        }

        return {
          title: doc.title,
          url: doc.url,
          path: path,
          description: doc.description,
          excerpt: excerpt,
          score: score,
        };
      })
      .filter((item): item is SearchResult => item !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }
}

export interface SitemapUrl {
  loc: string;
  lastmod: string;
}

export interface DocumentContent {
  url: string;
  lastmod: string;
  title: string;
  description: string;
  content: string;
  path: string;
}

export interface FileProcessResult {
  url: string;
  filePath: string;
  hash: string;
  modified: boolean;
  isNew: boolean;
  contentLength: number;
}

export interface FetcherStats {
  totalUrls: number;
  processedUrls: number;
  modifiedUrls: number;
  errors: number;
  totalBytes: number;
}

export interface CacheData {
  lastRun: string;
  urls: Record<string, string>; // Map<url, lastmod>
}

export interface SearchResult {
  title: string;
  url: string;
  path: string;
  description: string;
  excerpt: string;
  score: number;
}

export interface DocumentIndex {
  documents: Record<string, DocumentContent>;
  keywords: Record<string, string[]>; // keyword -> list of document paths
}

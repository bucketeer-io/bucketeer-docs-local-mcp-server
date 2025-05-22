import * as path from 'path';
import axios from 'axios';
import { config } from '../../config/index.js';
import {
  ensureDirectoryExists,
  fileExists,
  readFile,
  writeFile,
} from '../../utils/fileUtils.js';
import { formatDuration, generateHash } from '../../utils/helpers.js';
import {
  CacheData,
  DocumentContent,
  FetcherStats,
  FileProcessResult,
} from './types.js';

const axiosInstance = axios.create({
  timeout: 30000,
  headers: {
    'User-Agent': 'BucketeerDocsIndexer/1.0',
    Accept: 'application/vnd.github.v3+json',
  },
  maxRedirects: 5,
  responseType: 'json', // Changed to json for GitHub API
  validateStatus: (status) => status >= 200 && status < 400,
});

interface GithubApiContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: string;
  content?: string;
  encoding?: string;
}

export class GithubDocumentFetcher {
  private readonly outputDir: string = config.docsDir;
  private readonly githubApiUrl: string =
    'https://api.github.com/repos/bucketeer-io/bucketeer-docs/contents';
  private readonly cacheFile: string = path.join(
    this.outputDir,
    'github_cache.json'
  );
  private stats: FetcherStats = {
    totalUrls: 0,
    processedUrls: 0,
    modifiedUrls: 0,
    errors: 0,
    totalBytes: 0,
  };
  private startTime = 0;

  public async fetchAndProcessDocuments(
    forceUpdate = false
  ): Promise<FileProcessResult[]> {
    this.startTime = Date.now();
    console.error(
      `Starting GitHub document fetch process from ${this.githubApiUrl}`
    );
    await ensureDirectoryExists(this.outputDir);

    const cache = await this.loadCache();
    console.error(`Last successful run recorded: ${cache.lastRun || 'Never'}`);

    // Recursively fetch all markdown files from the docs directory
    const files = await this.listRepositoryFiles('docs');
    this.stats.totalUrls = files.length;
    console.error(`Found ${this.stats.totalUrls} files in GitHub repository.`);

    const filesToProcess = forceUpdate
      ? files
      : this.filterFilesToUpdate(files, cache);
    console.error(
      `Processing ${filesToProcess.length} files (${
        forceUpdate ? 'forced update' : 'based on cache'
      }).`
    );

    if (filesToProcess.length === 0 && !forceUpdate) {
      console.error('No documents require updating.');
      this.printStats();
      return [];
    }

    const results: FileProcessResult[] = [];
    const batchSize = 3; // GitHub API has rate limits, so use smaller batch size

    for (let i = 0; i < filesToProcess.length; i += batchSize) {
      const batch = filesToProcess.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((file) => this.processFile(file))
      );

      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
          this.stats.processedUrls++;
          if (result.value.isNew || result.value.modified) {
            this.stats.modifiedUrls++;
          }
          this.stats.totalBytes += result.value.contentLength;
        } else if (result.status === 'rejected') {
          this.stats.errors++;
          const reason = result.reason ?? 'Unknown error';
          console.error(
            `Error processing file ${batch[index]?.path || 'unknown'}:`,
            reason
          );
        }
      });
      this.printProgress();

      // Add a delay to avoid GitHub API rate limits
      if (i + batchSize < filesToProcess.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Update cache with successfully processed files
    for (const file of filesToProcess) {
      const successfulFile = results.find((r) => r.url === file.html_url);
      if (successfulFile) {
        cache.urls[file.path] = file.sha;
      }
    }

    await this.saveCache(cache);
    await this.updateSummary(results);

    console.error('\nGitHub document fetch process completed.');
    this.printStats();
    return results;
  }

  private async listRepositoryFiles(
    directory = 'docs'
  ): Promise<GithubApiContent[]> {
    try {
      const url = `${this.githubApiUrl}/${directory}`;
      console.error(`Fetching GitHub repository contents from: ${url}`);

      const response = await axiosInstance.get(url);
      const contents: GithubApiContent[] = response.data;

      let files: GithubApiContent[] = [];

      for (const item of contents) {
        if (item.type === 'file' && item.name.endsWith('.mdx')) {
          console.error(`Found markdown file: ${item.path}`);
          files.push(item);
        } else if (item.type === 'dir') {
          console.error(`Found directory: ${item.path}, fetching contents...`);
          // Recursively fetch files from subdirectories
          try {
            const subFiles = await this.listRepositoryFiles(item.path);
            files = files.concat(subFiles);
          } catch (error) {
            if (error instanceof Error) {
              console.error(
                `Error fetching subdirectory ${item.path}:`,
                error.message
              );
            } else {
              console.error(`Error fetching subdirectory ${item.path}:`, error);
            }
          }
        }
      }

      return files;
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `Error listing GitHub repository files from ${directory}:`,
          error.message
        );
        // 型ガードでerrorがオブジェクトかつ'response'プロパティを持つ場合のみ処理
        if (
          typeof error === 'object' &&
          error !== null &&
          'response' in error
        ) {
          const errObj = error as {
            response?: { status?: unknown; data?: unknown };
          };
          if (errObj.response) {
            console.error(
              `GitHub API response status: ${errObj.response.status}`
            );
            console.error('GitHub API response data:', errObj.response.data);
          }
        }
      } else {
        console.error(
          `Error listing GitHub repository files from ${directory}:`,
          error
        );
      }
      throw new Error(
        `Failed to list files from GitHub repository directory: ${directory}`
      );
    }
  }

  private async processFile(
    file: GithubApiContent
  ): Promise<FileProcessResult | null> {
    if (!file.name.endsWith('.mdx')) {
      return null; // Skip non-markdown files
    }

    const url = file.html_url;
    const filePath = path.join(
      this.outputDir,
      this.githubPathToFilename(file.path)
    );

    try {
      console.error(`Processing file: ${file.path}`);
      const content = await this.fetchFileContent(file.download_url);
      if (!content) {
        console.error(`Failed to fetch content for: ${file.path}`);
        return null;
      }

      const documentContent = this.processMarkdownContent(content, file);
      const contentStr = JSON.stringify(documentContent, null, 2);
      const currentHash = generateHash(contentStr);

      let modified = false;
      let isNew = false;

      if (await fileExists(filePath)) {
        const existingContent = await readFile(filePath);
        const existingHash = generateHash(existingContent);
        modified = currentHash !== existingHash;
      } else {
        isNew = true;
      }

      if (isNew || modified) {
        await writeFile(filePath, contentStr);
        console.error(
          `Saved ${isNew ? 'new' : 'modified'} document: ${path.basename(
            filePath
          )} (Path: ${file.path})`
        );
      }

      return {
        url,
        filePath,
        hash: currentHash,
        modified,
        isNew,
        contentLength: contentStr.length,
      };
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Failed to process file ${file.path}:`, error.message);
      } else {
        console.error(`Failed to process file ${file.path}:`, error);
      }
      this.stats.errors++;
      return null;
    }
  }

  private async fetchFileContent(
    downloadUrl: string | null
  ): Promise<string | null> {
    if (!downloadUrl) {
      console.error('No download URL provided for file');
      return null;
    }

    try {
      // Use raw GitHub URL for direct content access
      const response = await axios.get(downloadUrl, {
        headers: {
          'User-Agent': 'BucketeerDocsIndexer/1.0',
        },
        responseType: 'text',
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      if (error instanceof Error) {
        console.error(
          `Error fetching file content from ${downloadUrl}:`,
          error.message
        );
      } else {
        console.error(
          `Error fetching file content from ${downloadUrl}:`,
          error
        );
      }
      return null;
    }
  }

  private processMarkdownContent(
    content: string,
    file: GithubApiContent
  ): DocumentContent {
    let title = path.basename(file.path, '.mdx');
    let description = '';
    let contentBody = content;

    // Extract frontmatter if present (between --- markers)
    const frontmatterMatch = contentBody.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];

      // Extract title from frontmatter
      const titleMatch = frontmatter.match(/title:\s*["']?(.*?)["']?\s*$/m);
      if (titleMatch) {
        title = titleMatch[1];
      }

      // Extract description from frontmatter
      const descriptionMatch = frontmatter.match(
        /description:\s*["']?(.*?)["']?\s*$/m
      );
      if (descriptionMatch) {
        description = descriptionMatch[1];
      }

      // Remove frontmatter from content
      contentBody = contentBody.replace(frontmatterMatch[0], '');
    }

    // If no title found in frontmatter, look for first # heading
    if (title === path.basename(file.path, '.mdx')) {
      const headingMatch = contentBody.match(/^\s*#\s+(.*?)(?:\n|$)/m);
      if (headingMatch) {
        title = headingMatch[1].trim();
      }
    }

    // If no description in frontmatter, use first paragraph
    if (!description) {
      // Remove markdown headers and get first meaningful paragraph
      const cleanContent = contentBody.replace(/^\s*#{1,6}\s+.*$/gm, '').trim();
      const paragraphMatch = cleanContent.match(
        /^([^\n]+(?:\n[^\n]+)*?)(?:\n\s*\n|$)/
      );
      if (paragraphMatch) {
        description = paragraphMatch[1]
          .replace(/\n/g, ' ')
          .substring(0, 160)
          .trim();
      }
    }

    // Build URL for the document on the website
    // Convert GitHub path to website URL
    const urlPath = file.path
      .replace('docs/', '')
      .replace(/\.mdx$/, '')
      .replace(/\/index$/, ''); // Remove trailing /index

    const websiteUrl = urlPath
      ? `${config.websiteUrl}/${urlPath}`
      : config.websiteUrl;

    // Create document path for indexing
    const documentPath = file.path.replace('docs/', '').replace(/\.mdx$/, '');

    return {
      url: websiteUrl,
      path: documentPath,
      lastmod: new Date().toISOString(),
      title: title || 'Untitled',
      description: description || '',
      content: contentBody.trim(),
    };
  }

  private githubPathToFilename(githubPath: string): string {
    // Convert GitHub path to a safe filename
    return `${githubPath
      .replace('docs/', '')
      .replace(/\//g, '-')
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9-_.]/g, '-')}.json`;
  }

  private filterFilesToUpdate(
    files: GithubApiContent[],
    cache: CacheData
  ): GithubApiContent[] {
    return files.filter((file) => {
      const cachedSha = cache.urls[file.path];
      return !cachedSha || cachedSha !== file.sha;
    });
  }

  private async loadCache(): Promise<CacheData> {
    try {
      if (await fileExists(this.cacheFile)) {
        const cacheContent = await readFile(this.cacheFile);
        const parsed = JSON.parse(cacheContent);
        if (
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed.urls === 'object'
        ) {
          return parsed as CacheData;
        }
        console.warn(
          `Cache file ${this.cacheFile} has invalid format. Starting fresh.`
        );
      }
    } catch (error) {
      console.error(
        `Error reading cache file ${this.cacheFile}, creating a new one:`,
        error
      );
    }
    return { lastRun: '', urls: {} };
  }

  private async saveCache(cache: CacheData): Promise<void> {
    try {
      cache.lastRun = new Date().toISOString();
      await writeFile(this.cacheFile, JSON.stringify(cache, null, 2));
      console.error(`Cache saved to: ${this.cacheFile}`);
    } catch (error) {
      console.error(`Error saving cache to ${this.cacheFile}:`, error);
    }
  }

  private async updateSummary(results: FileProcessResult[]): Promise<void> {
    const summaryPath = path.join(this.outputDir, 'summary.json');
    let summary: { url: string; title: string; filename: string }[] = [];
    try {
      if (await fileExists(summaryPath)) {
        const existingContent = await readFile(summaryPath);
        summary = JSON.parse(existingContent);
      }
    } catch (error) {
      console.warn(
        `Could not load existing summary file: ${summaryPath}`,
        error
      );
    }

    const summaryMap = new Map(summary.map((item) => [item.url, item]));
    let updatedCount = 0;

    for (const result of results) {
      if (result && (result.isNew || result.modified)) {
        try {
          const content = await readFile(result.filePath);
          const pageData = JSON.parse(content) as DocumentContent;
          summaryMap.set(result.url, {
            url: result.url,
            title: pageData.title || 'No Title',
            filename: path.basename(result.filePath),
          });
          updatedCount++;
        } catch (error) {
          console.error(
            `Error reading/parsing updated file for summary: ${result.filePath}`,
            error
          );
        }
      }
    }

    if (updatedCount > 0) {
      try {
        await writeFile(
          summaryPath,
          JSON.stringify(Array.from(summaryMap.values()), null, 2)
        );
        console.error(
          `Summary file updated with ${updatedCount} changes at: ${summaryPath}`
        );
      } catch (error) {
        console.error(`Error writing summary file: ${summaryPath}`, error);
      }
    } else {
      console.error('Summary file remains unchanged.');
    }
  }

  private printProgress(): void {
    const processed = this.stats.processedUrls;
    const total = this.stats.totalUrls;
    const percentage =
      total > 0 ? ((processed / total) * 100).toFixed(1) : '0.0';
    const elapsedSecs = (Date.now() - this.startTime) / 1000;
    const rate =
      elapsedSecs > 0 ? (processed / elapsedSecs).toFixed(2) : '0.00';
    process.stderr.write(
      `\rProgress: ${processed}/${total} files (${percentage}%) | Modified: ${this.stats.modifiedUrls} | Errors: ${this.stats.errors} | Rate: ${rate} files/sec`
    );
  }

  private printStats(): void {
    const elapsedSecs = (Date.now() - this.startTime) / 1000;
    const mbProcessed = (this.stats.totalBytes / (1024 * 1024)).toFixed(2);
    console.error('\n--- GitHub Fetcher Stats ---');
    console.error(`Total Files: ${this.stats.totalUrls}`);
    console.error(`Files Processed: ${this.stats.processedUrls}`);
    console.error(`Files Modified/New: ${this.stats.modifiedUrls}`);
    console.error(`Errors Encountered: ${this.stats.errors}`);
    console.error(`Total Data Processed: ${mbProcessed} MB`);
    console.error(`Total Time: ${formatDuration(elapsedSecs)}`);
    console.error('---------------------------');
  }
}

import { fileURLToPath } from 'url';
import { config } from '../config/index.js';
import { DocumentFetcher } from '../core/indexing/documentFetcher.js';
import { GithubDocumentFetcher } from '../core/indexing/githubDocumentFetcher.js';
import { IndexManager } from '../core/indexing/indexManager.js';
import { FileProcessResult } from '../core/indexing/types.js';
import { ensureDirectoryExists, removeDirectory } from '../utils/fileUtils.js';

async function runIndexing(): Promise<void> {
  console.log('Starting Bucketeer Documentation Indexing Process...');
  const startTime = Date.now();

  const forceUpdate = process.argv.includes('--force');
  if (forceUpdate) {
    console.log(
      'Force update requested. Cache will be ignored and index rebuilt.'
    );
  }

  let processedFiles: FileProcessResult[] = [];
  try {
    // Use GitHub or web fetcher based on configuration
    if (config.useGithubSource) {
      console.log('Using GitHub repository as the source for documentation.');
      const fetcher = new GithubDocumentFetcher();
      processedFiles = await fetcher.fetchAndProcessDocuments(forceUpdate);
    } else {
      console.log('Using website as the source for documentation.');
      const fetcher = new DocumentFetcher();
      processedFiles = await fetcher.fetchAndProcessDocuments(forceUpdate);
    }

    if (processedFiles.length === 0 && !forceUpdate) {
      console.log(
        'No documents were updated based on the cache. Index remains unchanged.'
      );
      const endTime = Date.now();
      console.log(
        `Indexing process finished in ${(endTime - startTime) / 1000} seconds.`
      );
      return;
    }
  } catch (error) {
    console.error('Fatal error during document fetching/processing:', error);
    process.exit(1);
  }

  const indexManager = new IndexManager();
  const shouldRebuildIndex =
    forceUpdate || processedFiles.some((f) => f.isNew || f.modified);

  if (shouldRebuildIndex) {
    console.log(
      'Changes detected or force update requested. Rebuilding index...'
    );
    try {
      console.log(`Cleaning index directory: ${config.indexDir}`);
      await removeDirectory(config.indexDir);
      await ensureDirectoryExists(config.indexDir);

      // Build index
      await indexManager.buildIndex(config.docsDir);
      console.log('Index build complete.');
    } catch (error) {
      console.error('Fatal error during index creation:', error);
      process.exit(1);
    }
  } else {
    console.log('No significant changes detected. Index rebuild skipped.');
    if (!(await indexManager.loadIndex())) {
      console.error(
        'Index rebuild was skipped, but the existing index could not be loaded. Please check index files or run with --force.'
      );
    }
  }

  const endTime = Date.now();
  console.log(
    `Indexing process finished successfully in ${
      (endTime - startTime) / 1000
    } seconds.`
  );
}

const scriptPath = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] === scriptPath;

if (isDirectRun) {
  runIndexing().catch((error) => {
    console.error('Unhandled error during indexing:', error);
    process.exit(1);
  });
}

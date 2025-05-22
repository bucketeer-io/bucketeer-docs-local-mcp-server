import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve project root assuming config is in src/config
const projectRoot = path.resolve(__dirname, '..', '..');

interface AppConfig {
  siteName: string;
  websiteUrl: string;
  sitemapUrl: string;
  githubRepo: string;
  githubRawContentUrl: string;
  docsDirectory: string;
  baseDir: string;
  docsDir: string;
  indexDir: string;
  searchLimitDefault: number;
  useGithubSource: boolean;
}

export const config: AppConfig = {
  siteName: 'Bucketeer',
  websiteUrl: 'https://docs.bucketeer.io',
  sitemapUrl: 'https://docs.bucketeer.io/sitemap.xml',
  githubRepo: 'https://github.com/bucketeer-io/bucketeer-docs',
  githubRawContentUrl:
    'https://raw.githubusercontent.com/bucketeer-io/bucketeer-docs/main/docs',
  docsDirectory: 'docs', // Directory in the GitHub repo containing markdown files
  baseDir: path.join(projectRoot, 'files'),
  docsDir: path.join(projectRoot, 'files', 'docs'),
  indexDir: path.join(projectRoot, 'files', 'index'),
  searchLimitDefault: 5,
  useGithubSource: true, // Set to true to use GitHub repo, false to crawl website
};

# Bucketeer Docs Local MCP Server

## Overview

This project provides a Model Context Protocol (MCP) server for Bucketeer documentation. It offers an interface for searching and retrieving content from Bucketeer's feature flag and experimentation platform documentation, enabling AI assistants to provide accurate information about Bucketeer's features and usage.

## Environment Setup

### Requirements

- Node.js 18+
- npm

### Installation Steps

1. Clone the repository:

```bash
git clone <repository-url>
cd bucketeer-docs-local-mcp-server
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

4. Build the document index:

```bash
npm run build:index
```

## Starting the Server

```bash
npm start
```

## Document Sources

The server automatically fetches and indexes documentation from the [bucketeer-io/bucketeer-docs](https://github.com/bucketeer-io/bucketeer-docs) repository:

- **GitHub Repository Integration**: 
  - Automatically fetches `.mdx` files from the `docs/` directory and all subdirectories
  - Processes frontmatter and markdown content for optimal search indexing
  - Caches fetched content using SHA hashes and only updates when files are modified
  - Supports recursive directory traversal to capture all documentation files

- **Intelligent Indexing**:
  - Extracts keywords from titles, descriptions, headers, and content
  - Builds searchable index with relevance scoring based on keyword matches and full-text search
  - Optimized for Bucketeer-specific terminology (feature flags, experiments, SDKs, targeting, etc.)
  - Handles frontmatter extraction (title, description) from MDX files

- **Cache Management**:
  - Files are cached locally in `files/docs/` directory as JSON files
  - Document index is stored in `files/index/document-index.json`
  - GitHub cache stored in `files/docs/github_cache.json` with SHA-based change detection
  - Use `npm run build:index:force` to force rebuild the entire index

## Cursor and Claude Desktop Configuration

### Setup

Configure the MCP Server by adding the following to your `mcp.json` or `claude_desktop_config.json` file, referring to the documentation for Cursor (https://docs.cursor.com/context/model-context-protocol#configuring-mcp-servers) and Claude Desktop (https://modelcontextprotocol.io/quickstart/user):

```json
{
  "mcpServers": {
    "bucketeer-docs": {
      "type": "stdio",
      "command": "npm",
      "args": ["start", "--prefix", "/path/to/bucketeer-docs-local-mcp-server"]
    }
  }
}
```

## Usage

When the MCP server is running, the following tools are available:

### 1. `search_docs` - Search Bucketeer Documentation
- **Parameter**: `query` (string) - The search query
- **Parameter**: `limit` (number, optional) - Maximum number of results to return (default: 5)

**Example**:
```json
{
  "name": "search_docs",
  "arguments": {
    "query": "feature flags SDK integration",
    "limit": 5
  }
}
```

**Response**: Returns an array of search results with title, URL, path, description, excerpt, and relevance score.

### 2. `get_document` - Get Specific Document Content
- **Parameter**: `path` (string) - Document path obtained from search results

**Example**:
```json
{
  "name": "get_document",
  "arguments": {
    "path": "getting-started/create-feature-flag"
  }
}
```

**Response**: Returns the full document content including title, description, URL, and complete markdown content.


## Development Commands

- `npm run build` - Compile TypeScript files to `dist/` directory
- `npm run build:index` - Build/update the document index from GitHub repository
- `npm run build:index:force` - Force rebuild the entire index (ignores cache)
- `npm run dev:index` - Build and update index in development mode
- `npm run dev` - Build and start server in development mode
- `npm run lint` - Run Biome linting
- `npm run lint:fix` - Run Biome linting and fix linting errors

## Configuration

The server is configured via `src/config/index.ts`:

- **siteName**: "Bucketeer"
- **websiteUrl**: "https://docs.bucketeer.io"
- **githubRepo**: "https://github.com/bucketeer-io/bucketeer-docs"
- **docsDirectory**: "docs" (directory in GitHub repo containing documentation)
- **searchLimitDefault**: 5 (default number of search results)
- **useGithubSource**: true (always uses GitHub as source)

## File Structure

```
files/
├── docs/           # Cached JSON files from GitHub repository
├── index/          # Document search index
│   └── document-index.json
└── [created automatically when building index]
```

## Architecture

The server consists of several key components:

1. **GithubDocumentFetcher**: Recursively fetches `.mdx` files from the GitHub repository
2. **IndexManager**: Builds and manages the searchable document index
3. **SearchService**: Provides search functionality with keyword matching and full-text search
4. **MCP Server**: Exposes tools via the Model Context Protocol

## License

Apache License 2.0, see [LICENSE](https://github.com/bucketeer-io/bucketeer/blob/master/LICENSE).

## Contributing

We would ❤️ for you to contribute to Bucketeer and help improve it! Anyone can use and enjoy it!

Please follow our contribution guide [here](https://docs.bucketeer.io/contribution-guide/contributing).
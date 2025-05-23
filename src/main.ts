#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
// src/main.ts
import { startMcpServer } from './mcp/server.js';

async function main() {
  try {
    await startMcpServer();
    console.error(
      'MCP Server setup complete. Process waiting indefinitely for transport closure or signals.'
    );
    await new Promise(() => {});
  } catch (error) {
    console.error('Fatal error starting the application:', error);
    process.exit(1);
  }
}

main();

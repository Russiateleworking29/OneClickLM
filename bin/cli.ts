#!/usr/bin/env node

import { login } from "../src/auth/login.js";
import { extractTokensFromPage } from "../src/auth/tokens.js";
import { loadCookies } from "../src/auth/cookies.js";
import { startServer } from "../src/mcp/server.js";
import { formatError } from "../src/utils/errors.js";
import { logger } from "../src/utils/logger.js";

const VERSION = "1.0.0";
const command = process.argv[2];

const BANNER = `
  ╔═══════════════════════════════════════════╗
  ║         🧠 OneClickLM v${VERSION}            ║
  ║                                           ║
  ║  The NotebookLM MCP server that           ║
  ║  actually works.                          ║
  ╚═══════════════════════════════════════════╝
`;

async function main() {
  switch (command) {
    case "login": {
      console.log(BANNER);
      await login();
      break;
    }

    case "refresh": {
      console.log("🔄 Refreshing tokens...");
      const cookies = await loadCookies();
      if (!cookies) {
        console.error('❌ No cookies found. Run "npx oneclicklm login" first.');
        process.exit(1);
      }
      const tokens = await extractTokensFromPage(cookies);
      console.log(`✅ Tokens refreshed!`);
      console.log(`   Build label: ${tokens.buildLabel}`);
      console.log(`   Updated: ${tokens.updatedAt}`);
      break;
    }

    case "status": {
      const cookies = await loadCookies();
      if (!cookies) {
        console.log('❌ Not logged in.');
        console.log('   Run "npx oneclicklm login" to get started.');
        process.exit(1);
      }
      console.log(`✅ Logged in (${cookies.length} cookies saved)`);
      try {
        const tokens = await extractTokensFromPage(cookies);
        console.log(`   CSRF: ${tokens.csrfToken.substring(0, 15)}...`);
        console.log(`   Session: ${tokens.sessionId.substring(0, 10)}...`);
        console.log(`   Build: ${tokens.buildLabel}`);
        console.log(`   Updated: ${tokens.updatedAt}`);
        console.log("\n🟢 Everything looks good! MCP server is ready to use.");
      } catch {
        console.log('   ⚠️  Token verification failed.');
        console.log('   Try "npx oneclicklm refresh" or "npx oneclicklm login".');
      }
      break;
    }

    case "version":
    case "--version":
    case "-v": {
      console.log(`oneclicklm v${VERSION}`);
      break;
    }

    case "help":
    case "--help":
    case "-h": {
      console.log(BANNER);
      console.log(`Usage:
  npx oneclicklm              Start the MCP server (stdio transport)
  npx oneclicklm login        Login with your Google account (one-time)
  npx oneclicklm refresh      Force-refresh auth tokens
  npx oneclicklm status       Check authentication status
  npx oneclicklm version      Show version
  npx oneclicklm help         Show this help

Environment variables:
  ONECLICKLM_DIR       Config directory (default: ~/.oneclicklm)
  ONECLICKLM_LOG       Log level: debug | info | warn | error
  ONECLICKLM_TIMEOUT   Request timeout in ms (default: 30000)
  CHROME_PATH          Custom Chrome/Chromium path for login

MCP Tools available:
  notebook_list        List all notebooks
  notebook_get         Get notebook details + sources
  notebook_query       Ask a question to a notebook
  notebook_create      Create a new notebook
  source_add           Add a URL/text/YouTube source
  source_list          List sources in a notebook

Quickstart:
  1. npx oneclicklm login       # One-time Google sign-in
  2. Add to your MCP client config:
     {"mcpServers":{"notebooklm":{"command":"npx","args":["oneclicklm"]}}}
  3. Ask your AI: "List my NotebookLM notebooks"
`);
      break;
    }

    default: {
      // No command = start MCP server
      await startServer();
      break;
    }
  }
}

main().catch((err) => {
  console.error(`\n❌ ${formatError(err)}\n`);
  process.exit(1);
});

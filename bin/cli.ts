#!/usr/bin/env node

import { login } from "../src/auth/login.js";
import { extractTokensFromPage } from "../src/auth/tokens.js";
import { loadCookies } from "../src/auth/cookies.js";
import { startServer } from "../src/mcp/server.js";
import { formatError } from "../src/utils/errors.js";
import { logger } from "../src/utils/logger.js";

const command = process.argv[2];

async function main() {
  switch (command) {
    case "login": {
      await login();
      break;
    }

    case "refresh": {
      console.log("Refreshing tokens...");
      const cookies = await loadCookies();
      if (!cookies) {
        console.error('No cookies found. Run "npx oneclicklm login" first.');
        process.exit(1);
      }
      const tokens = await extractTokensFromPage(cookies);
      console.log(`✅ Tokens refreshed (build_label: ${tokens.buildLabel})`);
      break;
    }

    case "status": {
      const cookies = await loadCookies();
      if (!cookies) {
        console.log("❌ Not logged in. Run \"npx oneclicklm login\".");
      } else {
        console.log(`✅ Logged in (${cookies.length} cookies saved)`);
        try {
          const tokens = await extractTokensFromPage(cookies);
          console.log(`   build_label: ${tokens.buildLabel}`);
          console.log(`   Updated: ${tokens.updatedAt}`);
        } catch {
          console.log("   ⚠️  Could not verify tokens. Try \"npx oneclicklm refresh\".");
        }
      }
      break;
    }

    case "help":
    case "--help":
    case "-h": {
      console.log(`
OneClickLM — The NotebookLM MCP server that actually works.

Usage:
  npx oneclicklm              Start the MCP server (stdio transport)
  npx oneclicklm login        Login with your Google account
  npx oneclicklm refresh      Force-refresh auth tokens
  npx oneclicklm status       Check authentication status
  npx oneclicklm help         Show this help message

Environment variables:
  ONECLICKLM_DIR       Config directory (default: ~/.oneclicklm)
  ONECLICKLM_LOG       Log level: debug, info, warn, error (default: info)
  ONECLICKLM_TIMEOUT   Request timeout in ms (default: 30000)
  CHROME_PATH          Custom Chrome/Chromium path for login
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
  console.error(formatError(err));
  process.exit(1);
});

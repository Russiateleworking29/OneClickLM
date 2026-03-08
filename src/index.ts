#!/usr/bin/env node

import { startServer } from "./mcp/server.js";
import { logger } from "./utils/logger.js";

startServer().catch((err) => {
  logger.error("Failed to start OneClickLM:", err);
  process.exit(1);
});

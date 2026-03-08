import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { logger } from "../utils/logger.js";
import { TokenError } from "../utils/errors.js";
import { loadCookies, getCookieHeader, ensureConfigDir } from "./cookies.js";

export interface Tokens {
  buildLabel: string;
  csrfToken: string;
  updatedAt: string;
}

function getTokensPath(): string {
  const dir = process.env.ONECLICKLM_DIR || join(homedir(), ".oneclicklm");
  return join(dir, "tokens.json");
}

export async function saveTokens(tokens: Tokens): Promise<void> {
  await ensureConfigDir();
  const path = getTokensPath();
  await writeFile(path, JSON.stringify(tokens, null, 2), "utf-8");
  logger.info("Saved tokens");
}

export async function loadTokens(): Promise<Tokens | null> {
  const path = getTokensPath();
  if (!existsSync(path)) return null;
  try {
    const data = await readFile(path, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function extractTokensFromPage(cookies?: import("./cookies.js").CookieData[]): Promise<Tokens> {
  if (!cookies) {
    cookies = (await loadCookies()) ?? undefined;
  }
  if (!cookies || cookies.length === 0) {
    throw new TokenError("No cookies available. Cannot extract tokens.");
  }

  const cookieHeader = getCookieHeader(cookies);

  logger.info("Fetching NotebookLM page to extract tokens...");

  const res = await fetch("https://notebooklm.google.com/", {
    headers: {
      Cookie: cookieHeader,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    redirect: "follow",
  });

  if (!res.ok) {
    throw new TokenError(
      `Failed to fetch NotebookLM page (HTTP ${res.status})`,
      "Your cookies may be expired. Run \"npx oneclicklm login\" to re-authenticate."
    );
  }

  const html = await res.text();

  // Extract build_label from the page HTML
  // It appears in a script tag as something like: "build_label":"cl/XXXXXXXX"
  const buildLabelMatch = html.match(/"build_label"\s*:\s*"([^"]+)"/);
  if (!buildLabelMatch) {
    // Try alternative pattern
    const altMatch = html.match(/build_label['"]\s*[:,]\s*['"](cl\/\d+)['"]/);
    if (!altMatch) {
      throw new TokenError(
        "Could not extract build_label from NotebookLM page.",
        "Google may have changed their page structure. Please open an issue at https://github.com/bravomylife-lab/OneClickLM/issues"
      );
    }
    var buildLabel = altMatch[1];
  } else {
    var buildLabel = buildLabelMatch[1];
  }

  // Extract CSRF token (usually from a meta tag or embedded in the page)
  // Google uses SNlM0e as the CSRF token name
  const csrfMatch = html.match(/SNlM0e['"]\s*[:,]\s*['"](.*?)['"]/);
  let csrfToken: string;
  if (csrfMatch) {
    csrfToken = csrfMatch[1];
  } else {
    // Try extracting from AT value in WIZ_global_data
    const atMatch = html.match(/\"AT\"\s*:\s*\"([^\"]+)\"/);
    if (atMatch) {
      csrfToken = atMatch[1];
    } else {
      // Fallback: extract any token-like value from the page
      const wizMatch = html.match(/WIZ_global_data\s*=\s*\{[^}]*"token"\s*:\s*"([^"]+)"/);
      if (wizMatch) {
        csrfToken = wizMatch[1];
      } else {
        throw new TokenError(
          "Could not extract CSRF token from NotebookLM page.",
          "Google may have changed their page structure. Please open an issue."
        );
      }
    }
  }

  logger.info(`Extracted build_label: ${buildLabel}`);
  logger.debug(`Extracted CSRF token: ${csrfToken.substring(0, 10)}...`);

  const tokens: Tokens = {
    buildLabel,
    csrfToken,
    updatedAt: new Date().toISOString(),
  };

  await saveTokens(tokens);
  return tokens;
}

export async function getValidTokens(): Promise<Tokens> {
  // First try to load saved tokens
  let tokens = await loadTokens();
  if (tokens) {
    const age = Date.now() - new Date(tokens.updatedAt).getTime();
    // If tokens are less than 1 hour old, use them
    if (age < 60 * 60 * 1000) {
      logger.debug("Using cached tokens");
      return tokens;
    }
    logger.info("Tokens are stale, refreshing...");
  }

  // Extract fresh tokens
  return extractTokensFromPage();
}

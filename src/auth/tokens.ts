/**
 * Token extraction and management for NotebookLM.
 *
 * Extracts SNlM0e (CSRF), FdrFJe (session ID), and build_label from
 * the NotebookLM page HTML. These are required for all API calls.
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { logger } from "../utils/logger.js";
import { TokenError } from "../utils/errors.js";
import { loadCookies, getCookieHeader, ensureConfigDir } from "./cookies.js";

export interface Tokens {
  csrfToken: string;   // SNlM0e
  sessionId: string;   // FdrFJe
  buildLabel: string;  // boq_labs-tailwind-frontend_YYYYMMDD...
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
  logger.info("Tokens saved");
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

function extractCsrfToken(html: string): string {
  const match = html.match(/"SNlM0e"\s*:\s*"([^"]+)"/);
  if (match) return match[1];
  throw new TokenError(
    "CSRF token (SNlM0e) not found in NotebookLM page.",
    "Your cookies may be expired. Run \"npx oneclicklm login\" to re-authenticate."
  );
}

function extractSessionId(html: string): string {
  const match = html.match(/"FdrFJe"\s*:\s*"([^"]+)"/);
  if (match) return match[1];
  logger.warn("Session ID (FdrFJe) not found. Continuing without it.");
  return "";
}

function extractBuildLabel(html: string): string {
  const match = html.match(/(boq_labs-tailwind-frontend_\d{8}\.\d+_p\d+)/);
  if (match) return match[1];
  const altMatch = html.match(/"build_label"\s*:\s*"([^"]+)"/);
  if (altMatch) return altMatch[1];
  logger.warn("build_label not found. Using empty string.");
  return "";
}

export async function extractTokensFromPage(
  cookies?: import("./cookies.js").CookieData[]
): Promise<Tokens> {
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

  const finalUrl = res.url;
  const html = await res.text();

  if (
    finalUrl.includes("accounts.google.com") ||
    html.includes("accounts.google.com/signin")
  ) {
    throw new TokenError(
      "Authentication expired — redirected to Google login.",
      "Run \"npx oneclicklm login\" to re-authenticate."
    );
  }

  const csrfToken = extractCsrfToken(html);
  const sessionId = extractSessionId(html);
  const buildLabel = extractBuildLabel(html);

  logger.info(`Extracted tokens: CSRF=${csrfToken.substring(0, 10)}..., bl=${buildLabel}`);

  const tokens: Tokens = {
    csrfToken,
    sessionId,
    buildLabel,
    updatedAt: new Date().toISOString(),
  };

  await saveTokens(tokens);
  return tokens;
}

export async function getValidTokens(): Promise<Tokens> {
  let tokens = await loadTokens();
  if (tokens) {
    const age = Date.now() - new Date(tokens.updatedAt).getTime();
    if (age < 60 * 60 * 1000) {
      logger.debug("Using cached tokens");
      return tokens;
    }
    logger.info("Tokens stale, refreshing...");
  }
  return extractTokensFromPage();
}

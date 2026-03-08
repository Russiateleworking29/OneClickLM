import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { logger } from "../utils/logger.js";

export interface CookieData {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: string;
}

function getConfigDir(): string {
  return process.env.ONECLICKLM_DIR || join(homedir(), ".oneclicklm");
}

function getCookiePath(): string {
  return join(getConfigDir(), "cookies.json");
}

export async function ensureConfigDir(): Promise<string> {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
    logger.info(`Created config directory: ${dir}`);
  }
  return dir;
}

export async function saveCookies(cookies: CookieData[]): Promise<void> {
  await ensureConfigDir();
  const path = getCookiePath();
  await writeFile(path, JSON.stringify(cookies, null, 2), "utf-8");
  logger.info(`Saved ${cookies.length} cookies to ${path}`);
}

export async function loadCookies(): Promise<CookieData[] | null> {
  const path = getCookiePath();
  if (!existsSync(path)) {
    logger.debug("No cookies file found");
    return null;
  }
  try {
    const data = await readFile(path, "utf-8");
    const cookies: CookieData[] = JSON.parse(data);
    logger.debug(`Loaded ${cookies.length} cookies`);
    return cookies;
  } catch (err) {
    logger.warn("Failed to read cookies file", err);
    return null;
  }
}

export function getCookieHeader(cookies: CookieData[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

export function findCookie(cookies: CookieData[], name: string): string | undefined {
  return cookies.find((c) => c.name === name)?.value;
}

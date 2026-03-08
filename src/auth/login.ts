import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
import { saveCookies, type CookieData } from "./cookies.js";
import { extractTokensFromPage } from "./tokens.js";
import { logger } from "../utils/logger.js";
import { AuthError } from "../utils/errors.js";

const NOTEBOOKLM_URL = "https://notebooklm.google.com/";

function findChromePath(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;

  const candidates =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : process.platform === "win32"
        ? [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium-browser",
            "/usr/bin/chromium",
            "/snap/bin/chromium",
          ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  throw new AuthError(
    "Chrome/Chromium not found on your system.",
    "Install Chrome or set CHROME_PATH environment variable. Example:\n  CHROME_PATH=/path/to/chrome npx oneclicklm login"
  );
}

export async function login(): Promise<void> {
  logger.info("Starting Google login flow...");

  const chromePath = findChromePath();
  logger.info(`Using Chrome at: ${chromePath}`);
  console.log("\nA browser window will open. Please sign in with your Google account.\n");

  const browser = await puppeteer.launch({
    headless: false,
    executablePath: chromePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    );

    await page.goto(NOTEBOOKLM_URL, { waitUntil: "networkidle2" });

    logger.info("Waiting for you to complete Google sign-in...");

    // Wait until we're on the NotebookLM page (login complete)
    await page.waitForFunction(
      () => window.location.hostname === "notebooklm.google.com" && !window.location.pathname.includes("signin"),
      { timeout: 300_000 }
    );

    // Give the page a moment to fully load
    await new Promise((r) => setTimeout(r, 3000));

    const puppeteerCookies = await page.cookies();
    const cookies: CookieData[] = puppeteerCookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      httpOnly: c.httpOnly ?? false,
      secure: c.secure,
      sameSite: c.sameSite,
    }));

    if (cookies.length === 0) {
      throw new AuthError("No cookies were captured during login.");
    }

    await saveCookies(cookies);
    logger.info(`Captured ${cookies.length} cookies.`);

    await extractTokensFromPage(cookies);
    logger.info("Login successful! Tokens extracted and saved.");

    console.log("\n✅ Login successful! You can now use OneClickLM.\n");
    console.log("Add this to your MCP client configuration:\n");
    console.log(JSON.stringify({
      mcpServers: {
        notebooklm: {
          command: "npx",
          args: ["oneclicklm"],
        },
      },
    }, null, 2));
    console.log("");
  } catch (err) {
    if (err instanceof AuthError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("timeout")) {
      throw new AuthError(
        "Login timed out after 5 minutes.",
        "Please try again and complete the Google sign-in faster."
      );
    }
    throw new AuthError(`Login failed: ${message}`);
  } finally {
    await browser.close();
  }
}

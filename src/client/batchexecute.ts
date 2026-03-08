/**
 * Google batchexecute protocol client for NotebookLM.
 *
 * Reverse-engineered from the NotebookLM web app's internal RPC protocol.
 * Uses the /_/LabsTailwindUi/data/batchexecute endpoint.
 */

import { loadCookies, getCookieHeader } from "../auth/cookies.js";
import { getValidTokens, extractTokensFromPage, type Tokens } from "../auth/tokens.js";
import { logger } from "../utils/logger.js";
import { APIError, AuthError } from "../utils/errors.js";

const BATCHEXECUTE_URL =
  "https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute";

export const QUERY_URL =
  "https://notebooklm.google.com/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed";

/**
 * Verified RPC Method IDs (from notebooklm-py rpc/types.py)
 */
export const RPC = {
  LIST_NOTEBOOKS: "wXbhsf",
  CREATE_NOTEBOOK: "CCqFvf",
  GET_NOTEBOOK: "rLM1Ne",
  RENAME_NOTEBOOK: "s0tc2d",
  DELETE_NOTEBOOK: "WWINqb",
  ADD_SOURCE: "izAoDd",
  DELETE_SOURCE: "tGMBJ",
  SUMMARIZE: "VfAZjd",
  GET_SOURCE_GUIDE: "tr032e",
} as const;

function encodeRpcRequest(rpcId: string, params: unknown[]): string {
  const paramsJson = JSON.stringify(params);
  const inner = [rpcId, paramsJson, null, "generic"];
  return JSON.stringify([[inner]]);
}

function buildRequestBody(
  rpcRequest: string,
  csrfToken: string
): string {
  const parts = [
    `f.req=${encodeURIComponent(rpcRequest)}`,
    `at=${encodeURIComponent(csrfToken)}`,
  ];
  return parts.join("&") + "&";
}

function buildUrl(
  rpcId: string,
  tokens: Tokens,
  sourcePath = "/"
): string {
  const params = new URLSearchParams({
    rpcids: rpcId,
    "source-path": sourcePath,
    hl: "en",
    rt: "c",
  });
  if (tokens.sessionId) params.set("f.sid", tokens.sessionId);
  if (tokens.buildLabel) params.set("bl", tokens.buildLabel);
  return `${BATCHEXECUTE_URL}?${params.toString()}`;
}

/**
 * Strip anti-XSSI prefix )]}'
 */
function stripAntiXssi(response: string): string {
  if (response.startsWith(")]}'")) {
    const idx = response.indexOf("\n");
    return idx >= 0 ? response.substring(idx + 1) : response;
  }
  return response;
}

/**
 * Parse chunked batchexecute response (rt=c mode).
 * Format: alternating lines of byte_count and json_payload.
 */
function parseChunkedResponse(response: string): unknown[][] {
  const chunks: unknown[][] = [];
  const lines = response.trim().split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    // Check if line is a byte count (integer)
    if (/^\d+$/.test(line)) {
      i++;
      if (i < lines.length) {
        try {
          const chunk = JSON.parse(lines[i]);
          if (Array.isArray(chunk)) chunks.push(chunk);
        } catch { /* skip malformed */ }
      }
      i++;
    } else {
      try {
        const chunk = JSON.parse(line);
        if (Array.isArray(chunk)) chunks.push(chunk);
      } catch { /* skip */ }
      i++;
    }
  }

  return chunks;
}

/**
 * Extract result for a specific RPC ID from parsed chunks.
 */
function extractRpcResult(chunks: unknown[][], rpcId: string): unknown {
  for (const chunk of chunks) {
    const items = (chunk.length > 0 && Array.isArray(chunk[0])) ? chunk : [chunk];
    for (const item of items) {
      if (!Array.isArray(item) || item.length < 3) continue;

      // Error response: ["er", rpcId, errorCode]
      if (item[0] === "er" && item[1] === rpcId) {
        const code = item[2];
        throw new APIError(
          typeof code === "number" ? code : 500,
          `RPC ${rpcId} returned error: ${code}`
        );
      }

      // Success response: ["wrb.fr", rpcId, jsonString, ...]
      if (item[0] === "wrb.fr" && item[1] === rpcId) {
        const resultData = item[2];
        if (typeof resultData === "string") {
          try { return JSON.parse(resultData); }
          catch { return resultData; }
        }
        return resultData;
      }
    }
  }
  return null;
}

/**
 * Execute a batchexecute RPC call to NotebookLM.
 */
export async function rpcCall(
  rpcId: string,
  params: unknown[],
  sourcePath = "/",
  retried = false
): Promise<unknown> {
  const cookies = await loadCookies();
  if (!cookies) {
    throw new AuthError("No cookies found. Please login first.");
  }

  const tokens = await getValidTokens();
  const cookieHeader = getCookieHeader(cookies);
  const rpcRequest = encodeRpcRequest(rpcId, params);
  const body = buildRequestBody(rpcRequest, tokens.csrfToken);
  const url = buildUrl(rpcId, tokens, sourcePath);
  const timeout = Number(process.env.ONECLICKLM_TIMEOUT) || 30000;

  logger.debug(`RPC ${rpcId} starting (source-path: ${sourcePath})`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Cookie: cookieHeader,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      if ((res.status === 400 || res.status === 401 || res.status === 403) && !retried) {
        logger.warn(`HTTP ${res.status} — refreshing tokens and retrying...`);
        await extractTokensFromPage(cookies);
        return rpcCall(rpcId, params, sourcePath, true);
      }
      throw new APIError(res.status, `RPC ${rpcId} failed: HTTP ${res.status}`);
    }

    const text = await res.text();
    const cleaned = stripAntiXssi(text);
    const chunks = parseChunkedResponse(cleaned);
    const result = extractRpcResult(chunks, rpcId);

    logger.debug(`RPC ${rpcId} completed`);
    return result;
  } catch (err) {
    if (err instanceof APIError || err instanceof AuthError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort")) {
      throw new APIError(408, `Request timed out after ${timeout}ms`);
    }
    throw new APIError(500, `RPC ${rpcId} failed: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Execute a streaming query via the GenerateFreeFormStreamed endpoint.
 * This is the separate endpoint used for chat, not batchexecute.
 */
export async function streamingQuery(
  notebookId: string,
  question: string,
  sourceIds: string[],
  retried = false
): Promise<{ answer: string; conversationId: string | null }> {
  const cookies = await loadCookies();
  if (!cookies) throw new AuthError("No cookies found. Please login first.");

  const tokens = await getValidTokens();
  const cookieHeader = getCookieHeader(cookies);
  const timeout = Number(process.env.ONECLICKLM_TIMEOUT) || 60000;

  const sourcesArray = sourceIds.map((sid) => [[sid]]);
  const conversationId = crypto.randomUUID();

  const params: unknown[] = [
    sourcesArray,
    question,
    null,             // conversation history
    [2, null, [1], [1]],
    conversationId,
    null,
    null,
    notebookId,
    1,
  ];

  const paramsJson = JSON.stringify(params);
  const fReq = JSON.stringify([null, paramsJson]);

  const bodyParts = [
    `f.req=${encodeURIComponent(fReq)}`,
  ];
  if (tokens.csrfToken) {
    bodyParts.push(`at=${encodeURIComponent(tokens.csrfToken)}`);
  }
  const body = bodyParts.join("&") + "&";

  const urlParams = new URLSearchParams({
    bl: tokens.buildLabel || "",
    hl: "en",
    _reqid: String(Math.floor(Math.random() * 900000) + 100000),
    rt: "c",
  });
  if (tokens.sessionId) urlParams.set("f.sid", tokens.sessionId);

  const url = `${QUERY_URL}?${urlParams.toString()}`;

  logger.debug(`Streaming query to notebook ${notebookId}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Cookie: cookieHeader,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      if ((res.status === 400 || res.status === 401) && !retried) {
        logger.warn(`Query HTTP ${res.status} — refreshing tokens and retrying...`);
        await extractTokensFromPage(cookies);
        return streamingQuery(notebookId, question, sourceIds, true);
      }
      throw new APIError(res.status, `Query failed: HTTP ${res.status}`);
    }

    const text = await res.text();
    return parseStreamingResponse(text);
  } catch (err) {
    if (err instanceof APIError || err instanceof AuthError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort")) {
      throw new APIError(408, `Query timed out after ${timeout}ms`);
    }
    throw new APIError(500, `Query failed: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse the streaming response to extract the answer text.
 */
function parseStreamingResponse(responseText: string): {
  answer: string;
  conversationId: string | null;
} {
  let text = responseText;
  if (text.startsWith(")]}'")) {
    text = text.substring(4);
  }

  const lines = text.trim().split("\n");
  let bestAnswer = "";
  let conversationId: string | null = null;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }

    let jsonStr: string | null = null;
    if (/^\d+$/.test(line)) {
      i++;
      if (i < lines.length) jsonStr = lines[i];
      i++;
    } else {
      jsonStr = line;
      i++;
    }

    if (!jsonStr) continue;

    try {
      const data = JSON.parse(jsonStr);
      if (!Array.isArray(data)) continue;

      for (const item of data) {
        if (!Array.isArray(item) || item.length < 3 || item[0] !== "wrb.fr") continue;

        const innerJson = item[2];
        if (typeof innerJson !== "string") continue;

        try {
          const innerData = JSON.parse(innerJson);
          if (!Array.isArray(innerData) || innerData.length === 0) continue;

          const first = innerData[0];
          if (!Array.isArray(first) || first.length === 0) continue;

          const answerText = first[0];
          if (typeof answerText === "string" && answerText.length > bestAnswer.length) {
            bestAnswer = answerText;
          }

          // Extract conversation ID from first[2]
          if (
            first.length > 2 &&
            Array.isArray(first[2]) &&
            first[2].length > 0 &&
            typeof first[2][0] === "string"
          ) {
            conversationId = first[2][0];
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  return { answer: bestAnswer, conversationId };
}

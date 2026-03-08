import { loadCookies, getCookieHeader } from "../auth/cookies.js";
import { getValidTokens, extractTokensFromPage, type Tokens } from "../auth/tokens.js";
import { logger } from "../utils/logger.js";
import { APIError, AuthError } from "../utils/errors.js";

const BATCHEXECUTE_URL = "https://notebooklm.google.com/batchexecute";

interface BatchExecuteRequest {
  rpcId: string;
  args: string;
}

interface BatchExecuteResponse {
  rpcId: string;
  data: unknown;
}

function buildRequestPayload(requests: BatchExecuteRequest[], tokens: Tokens): string {
  const encodedRequests = requests.map((req) => {
    return JSON.stringify([[[req.rpcId, req.args, null, "generic"]]]);
  });

  const params = new URLSearchParams();
  params.set("rpcids", requests.map((r) => r.rpcId).join(","));
  params.set("source-path", "/");
  params.set("f.sid", "");
  params.set("bl", tokens.buildLabel);
  params.set("hl", "en");
  params.set("_reqid", String(Math.floor(Math.random() * 900000) + 100000));
  params.set("rt", "c");

  const fReq = JSON.stringify(
    requests.map((req) => [[req.rpcId, req.args, null, "generic"]])
  );
  params.set("f.req", fReq);
  params.set("at", tokens.csrfToken);

  return params.toString();
}

function parseBatchResponse(responseText: string): BatchExecuteResponse[] {
  const results: BatchExecuteResponse[] = [];

  // The response format starts with )]}'  followed by newlines and JSON arrays
  const cleaned = responseText.replace(/^\)\]\}'/, "").trim();
  const lines = cleaned.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    // Each response chunk starts with a number (byte count)
    if (/^\d+$/.test(line) && i + 1 < lines.length) {
      try {
        const data = JSON.parse(lines[i + 1]);
        if (Array.isArray(data) && data.length >= 1) {
          const wrappedData = data[0];
          if (Array.isArray(wrappedData) && wrappedData.length >= 3) {
            const rpcId = wrappedData[0];
            const rawData = wrappedData[2];
            let parsedData: unknown;
            try {
              parsedData = JSON.parse(rawData);
            } catch {
              parsedData = rawData;
            }
            results.push({ rpcId, data: parsedData });
          }
        }
      } catch {
        // Skip unparseable chunks
      }
      i += 2;
    } else {
      i++;
    }
  }

  return results;
}

export async function batchExecute(
  requests: BatchExecuteRequest[],
  retried = false
): Promise<BatchExecuteResponse[]> {
  const cookies = await loadCookies();
  if (!cookies) {
    throw new AuthError("No cookies found. Please login first.");
  }

  let tokens = await getValidTokens();
  const cookieHeader = getCookieHeader(cookies);
  const body = buildRequestPayload(requests, tokens);

  const timeout = Number(process.env.ONECLICKLM_TIMEOUT) || 30000;

  logger.debug(`Executing batchexecute with RPCs: ${requests.map((r) => r.rpcId).join(", ")}`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(BATCHEXECUTE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Cookie: cookieHeader,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Origin: "https://notebooklm.google.com",
        Referer: "https://notebooklm.google.com/",
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      // If 400/401, try refreshing tokens once
      if ((res.status === 400 || res.status === 401) && !retried) {
        logger.warn(`Got HTTP ${res.status}, refreshing tokens and retrying...`);
        await extractTokensFromPage(cookies);
        return batchExecute(requests, true);
      }
      throw new APIError(res.status, `batchexecute failed: HTTP ${res.status}`);
    }

    const text = await res.text();
    return parseBatchResponse(text);
  } catch (err) {
    if (err instanceof APIError || err instanceof AuthError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort")) {
      throw new APIError(408, `Request timed out after ${timeout}ms`);
    }
    throw new APIError(500, `batchexecute failed: ${msg}`);
  } finally {
    clearTimeout(timer);
  }
}

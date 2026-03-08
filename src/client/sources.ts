/**
 * Source operations for NotebookLM.
 *
 * Supports adding URLs, text, and YouTube sources to notebooks.
 */

import { rpcCall, RPC } from "./batchexecute.js";
import { logger } from "../utils/logger.js";

export interface Source {
  id: string;
  title: string;
  type?: string;
  status?: string;
  url?: string;
}

/**
 * List all sources in a notebook.
 * Uses GET_NOTEBOOK (rLM1Ne) and extracts sources from the response.
 */
export async function listSources(notebookId: string): Promise<Source[]> {
  logger.info(`Listing sources for notebook: ${notebookId}`);
  const result = await rpcCall(
    RPC.GET_NOTEBOOK,
    [notebookId, null, [2], null, 0],
    `/notebook/${notebookId}`
  );

  const sources: Source[] = [];
  if (!Array.isArray(result)) return sources;

  try {
    const nbInfo = Array.isArray(result[0]) ? result[0] : result;
    if (!Array.isArray(nbInfo[1])) return sources;

    for (const src of nbInfo[1]) {
      if (!Array.isArray(src)) continue;
      const id =
        (Array.isArray(src[0]) && typeof src[0][0] === "string")
          ? src[0][0]
          : "";
      if (!id) continue;

      let title = "Untitled";
      if (Array.isArray(src[0]) && typeof src[0][1] === "string") {
        title = src[0][1];
      }

      let status: string | undefined;
      if (Array.isArray(src[3]) && typeof src[3][1] === "number") {
        const statusMap: Record<number, string> = {
          1: "processing", 2: "ready", 3: "error", 5: "preparing"
        };
        status = statusMap[src[3][1]] || "unknown";
      }

      sources.push({ id, title, status });
    }
  } catch (err) {
    logger.warn("Failed to parse sources", err);
  }

  logger.info(`Found ${sources.length} source(s)`);
  return sources;
}

/**
 * Add a URL source (RPC: izAoDd).
 * Params: [[[null, null, [url], null, null, null, null, null]], notebook_id, [2], null, null]
 */
export async function addUrlSource(
  notebookId: string,
  url: string
): Promise<unknown> {
  logger.info(`Adding URL source to ${notebookId}: ${url}`);
  const isYoutube = /youtube\.com|youtu\.be/i.test(url);

  let params: unknown[];
  if (isYoutube) {
    // YouTube uses position [7] in an 11-element array
    params = [
      [[null, null, null, null, null, null, null, [url], null, null, 1]],
      notebookId,
      [2],
      [1, null, null, null, null, null, null, null, null, null, [1]],
    ];
  } else {
    // Regular URL goes at position [2] in an 8-element array
    params = [
      [[null, null, [url], null, null, null, null, null]],
      notebookId,
      [2],
      null,
      null,
    ];
  }

  return rpcCall(RPC.ADD_SOURCE, params, `/notebook/${notebookId}`);
}

/**
 * Add a text source (RPC: izAoDd).
 * Params: [[[null, [title, content], null, null, null, null, null, null]], notebook_id, [2], null, null]
 */
export async function addTextSource(
  notebookId: string,
  title: string,
  content: string
): Promise<unknown> {
  logger.info(`Adding text source to ${notebookId}: "${title}"`);
  const params = [
    [[null, [title, content], null, null, null, null, null, null]],
    notebookId,
    [2],
    null,
    null,
  ];
  return rpcCall(RPC.ADD_SOURCE, params, `/notebook/${notebookId}`);
}

/**
 * Delete a source (RPC: tGMBJ).
 * Note: notebook_id goes in source_path, NOT in params!
 * Params: [[[source_id]]]
 */
export async function deleteSource(
  notebookId: string,
  sourceId: string
): Promise<boolean> {
  logger.info(`Deleting source ${sourceId} from ${notebookId}`);
  await rpcCall(
    RPC.DELETE_SOURCE,
    [[[sourceId]]],
    `/notebook/${notebookId}`
  );
  return true;
}

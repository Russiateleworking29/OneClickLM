/**
 * Notebook operations using verified RPC method IDs.
 *
 * RPC IDs sourced from notebooklm-py (teng-lin/notebooklm-py).
 */

import { rpcCall, streamingQuery, RPC } from "./batchexecute.js";
import { logger } from "../utils/logger.js";

export interface Notebook {
  id: string;
  title: string;
  description?: string;
  sourceCount: number;
  emoji?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotebookDetail extends Notebook {
  sources: NotebookSource[];
}

export interface NotebookSource {
  id: string;
  title: string;
  type?: string;
  url?: string;
  status?: string;
}

export interface QueryResult {
  answer: string;
  conversationId: string | null;
}

// ─── Parsing helpers ──────────────────────────────────────────────────────

function parseNotebook(raw: unknown): Notebook | null {
  if (!Array.isArray(raw)) return null;
  try {
    // Notebook structure varies but typically:
    // raw[0] = [notebook_id, ...], raw[1] = title area, etc.
    const id =
      (Array.isArray(raw[0]) && typeof raw[0][0] === "string")
        ? raw[0][0]
        : typeof raw[0] === "string"
          ? raw[0]
          : "";
    if (!id) return null;

    // Title is typically at raw[0][1] or raw[2] depending on context
    let title = "Untitled";
    if (Array.isArray(raw[0]) && typeof raw[0][1] === "string") {
      title = raw[0][1];
    } else if (typeof raw[2] === "string") {
      title = raw[2];
    }

    // Source count from raw[0][2] or from sources array length
    let sourceCount = 0;
    if (Array.isArray(raw[0]) && Array.isArray(raw[0][2])) {
      sourceCount = raw[0][2].length;
    }

    return { id, title, sourceCount };
  } catch (err) {
    logger.debug("Failed to parse notebook entry", err);
    return null;
  }
}

function parseNotebookDetail(raw: unknown): NotebookDetail | null {
  if (!Array.isArray(raw)) return null;
  try {
    const nbInfo = Array.isArray(raw[0]) ? raw[0] : raw;
    const id =
      (Array.isArray(nbInfo[0]) && typeof nbInfo[0][0] === "string")
        ? nbInfo[0][0]
        : typeof nbInfo[0] === "string"
          ? nbInfo[0]
          : "";

    let title = "Untitled";
    // Try multiple positions
    if (Array.isArray(nbInfo[0]) && typeof nbInfo[0][1] === "string") {
      title = nbInfo[0][1];
    }

    // Extract sources — typically at nbInfo[1] (array of source arrays)
    const sources: NotebookSource[] = [];
    const sourcesList = Array.isArray(nbInfo[1]) ? nbInfo[1] : [];
    for (const src of sourcesList) {
      if (!Array.isArray(src)) continue;
      const sourceId =
        (Array.isArray(src[0]) && typeof src[0][0] === "string")
          ? src[0][0]
          : typeof src[0] === "string"
            ? src[0]
            : "";
      if (!sourceId) continue;

      let sourceTitle = "Untitled source";
      // Source title at various positions
      if (Array.isArray(src[0]) && typeof src[0][1] === "string") {
        sourceTitle = src[0][1];
      } else if (typeof src[1] === "string") {
        sourceTitle = src[1];
      }

      // Status at src[3][1] per SourceStatus enum
      let status: string | undefined;
      if (Array.isArray(src[3]) && typeof src[3][1] === "number") {
        const statusMap: Record<number, string> = { 1: "processing", 2: "ready", 3: "error", 5: "preparing" };
        status = statusMap[src[3][1]] || "unknown";
      }

      sources.push({ id: sourceId, title: sourceTitle, status });
    }

    return {
      id,
      title,
      sourceCount: sources.length,
      sources,
    };
  } catch (err) {
    logger.debug("Failed to parse notebook detail", err);
    return null;
  }
}

// ─── API functions ────────────────────────────────────────────────────────

/**
 * List all notebooks (RPC: wXbhsf).
 * Params: [null, 1, null, [2]]
 */
export async function listNotebooks(): Promise<Notebook[]> {
  logger.info("Listing notebooks...");
  const result = await rpcCall(RPC.LIST_NOTEBOOKS, [null, 1, null, [2]]);

  if (!Array.isArray(result)) return [];

  const rawList = Array.isArray(result[0]) ? result[0] : result;
  const notebooks: Notebook[] = [];
  for (const item of rawList) {
    const nb = parseNotebook(item);
    if (nb) notebooks.push(nb);
  }

  logger.info(`Found ${notebooks.length} notebook(s)`);
  return notebooks;
}

/**
 * Get notebook details + sources (RPC: rLM1Ne).
 * Params: [notebook_id, null, [2], null, 0]
 */
export async function getNotebook(notebookId: string): Promise<NotebookDetail | null> {
  logger.info(`Getting notebook: ${notebookId}`);
  const result = await rpcCall(
    RPC.GET_NOTEBOOK,
    [notebookId, null, [2], null, 0],
    `/notebook/${notebookId}`
  );
  return parseNotebookDetail(result);
}

/**
 * Create a new notebook (RPC: CCqFvf).
 * Params: [title, null, null, [2], [1]]
 */
export async function createNotebook(title: string): Promise<Notebook | null> {
  logger.info(`Creating notebook: ${title}`);
  const result = await rpcCall(RPC.CREATE_NOTEBOOK, [title, null, null, [2], [1]]);
  return parseNotebook(result);
}

/**
 * Delete a notebook (RPC: WWINqb).
 * Params: [[notebook_id], [2]]
 */
export async function deleteNotebook(notebookId: string): Promise<boolean> {
  logger.info(`Deleting notebook: ${notebookId}`);
  await rpcCall(RPC.DELETE_NOTEBOOK, [[notebookId], [2]]);
  return true;
}

/**
 * Rename a notebook (RPC: s0tc2d).
 * Params: [notebook_id, [[null, null, null, [null, new_title]]]]
 */
export async function renameNotebook(
  notebookId: string,
  newTitle: string
): Promise<boolean> {
  logger.info(`Renaming notebook ${notebookId} to: ${newTitle}`);
  await rpcCall(
    RPC.RENAME_NOTEBOOK,
    [notebookId, [[null, null, null, [null, newTitle]]]],
    "/"
  );
  return true;
}

/**
 * Get notebook summary (RPC: VfAZjd).
 * Params: [notebook_id, [2]]
 */
export async function summarizeNotebook(notebookId: string): Promise<string> {
  logger.info(`Summarizing notebook: ${notebookId}`);
  const result = await rpcCall(
    RPC.SUMMARIZE,
    [notebookId, [2]],
    `/notebook/${notebookId}`
  );
  try {
    if (Array.isArray(result) && Array.isArray(result[0]) && Array.isArray(result[0][0])) {
      return String(result[0][0][0] || "");
    }
  } catch { /* fallback */ }
  return "";
}

/**
 * Query a notebook using the streaming chat endpoint.
 * First fetches source IDs, then sends the query.
 */
export async function queryNotebook(
  notebookId: string,
  query: string
): Promise<QueryResult> {
  logger.info(`Querying notebook ${notebookId}: "${query.substring(0, 50)}..."`);

  // Get source IDs from notebook
  const sourceIds = await getSourceIds(notebookId);
  logger.debug(`Got ${sourceIds.length} source IDs`);

  const result = await streamingQuery(notebookId, query, sourceIds);
  return result;
}

/**
 * Extract source IDs from a notebook for chat queries.
 */
async function getSourceIds(notebookId: string): Promise<string[]> {
  const result = await rpcCall(
    RPC.GET_NOTEBOOK,
    [notebookId, null, [2], null, 0],
    `/notebook/${notebookId}`
  );

  const ids: string[] = [];
  if (!Array.isArray(result)) return ids;

  try {
    const nbInfo = Array.isArray(result[0]) ? result[0] : result;
    if (Array.isArray(nbInfo[1])) {
      for (const source of nbInfo[1]) {
        if (Array.isArray(source) && Array.isArray(source[0]) && typeof source[0][0] === "string") {
          ids.push(source[0][0]);
        }
      }
    }
  } catch { /* empty */ }

  return ids;
}

import { batchExecute } from "./batchexecute.js";
import { logger } from "../utils/logger.js";

export interface Notebook {
  id: string;
  title: string;
  description?: string;
  sourceCount: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotebookDetail extends Notebook {
  sources: NotebookSource[];
}

export interface NotebookSource {
  id: string;
  title: string;
  type: string;
  url?: string;
}

export interface QueryResult {
  answer: string;
  sources: Array<{
    title: string;
    snippet: string;
  }>;
}

function parseNotebookList(data: unknown): Notebook[] {
  if (!Array.isArray(data)) return [];

  const notebooks: Notebook[] = [];
  try {
    // The response structure may vary; handle common patterns
    const items = Array.isArray(data[0]) ? data[0] : data;
    for (const item of items) {
      if (!Array.isArray(item)) continue;
      const notebook: Notebook = {
        id: item[0] || "",
        title: item[1] || "Untitled",
        description: item[2] || undefined,
        sourceCount: typeof item[3] === "number" ? item[3] : 0,
        updatedAt: item[4] || undefined,
      };
      if (notebook.id) {
        notebooks.push(notebook);
      }
    }
  } catch (err) {
    logger.warn("Failed to parse notebook list", err);
  }

  return notebooks;
}

function parseNotebookDetail(data: unknown): NotebookDetail | null {
  if (!Array.isArray(data)) return null;

  try {
    const sources: NotebookSource[] = [];
    const sourceList = Array.isArray(data[3]) ? data[3] : [];
    for (const src of sourceList) {
      if (!Array.isArray(src)) continue;
      sources.push({
        id: src[0] || "",
        title: src[1] || "Untitled source",
        type: src[2] || "unknown",
        url: src[3] || undefined,
      });
    }

    return {
      id: data[0] || "",
      title: data[1] || "Untitled",
      description: data[2] || undefined,
      sourceCount: sources.length,
      sources,
    };
  } catch (err) {
    logger.warn("Failed to parse notebook detail", err);
    return null;
  }
}

function parseQueryResult(data: unknown): QueryResult {
  if (!Array.isArray(data)) {
    return { answer: "No response received.", sources: [] };
  }

  try {
    const answer = typeof data[0] === "string" ? data[0] : JSON.stringify(data[0]);
    const sourceCitations: QueryResult["sources"] = [];

    if (Array.isArray(data[1])) {
      for (const cite of data[1]) {
        if (Array.isArray(cite)) {
          sourceCitations.push({
            title: cite[0] || "Unknown source",
            snippet: cite[1] || "",
          });
        }
      }
    }

    return { answer, sources: sourceCitations };
  } catch (err) {
    logger.warn("Failed to parse query result", err);
    return { answer: String(data), sources: [] };
  }
}

export async function listNotebooks(): Promise<Notebook[]> {
  logger.info("Listing notebooks...");
  const responses = await batchExecute([
    { rpcId: "LYSPOe", args: JSON.stringify([]) },
  ]);

  if (responses.length === 0) {
    return [];
  }

  return parseNotebookList(responses[0].data);
}

export async function getNotebook(notebookId: string): Promise<NotebookDetail | null> {
  logger.info(`Getting notebook: ${notebookId}`);
  const responses = await batchExecute([
    { rpcId: "GaSb3d", args: JSON.stringify([notebookId]) },
  ]);

  if (responses.length === 0) {
    return null;
  }

  return parseNotebookDetail(responses[0].data);
}

export async function queryNotebook(
  notebookId: string,
  query: string
): Promise<QueryResult> {
  logger.info(`Querying notebook ${notebookId}: "${query.substring(0, 50)}..."`);
  const responses = await batchExecute([
    { rpcId: "gIBKpc", args: JSON.stringify([notebookId, query]) },
  ]);

  if (responses.length === 0) {
    return { answer: "No response received from NotebookLM.", sources: [] };
  }

  return parseQueryResult(responses[0].data);
}

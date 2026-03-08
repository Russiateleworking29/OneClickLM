/**
 * MCP Tool definitions and handlers.
 *
 * 6 core tools for NotebookLM interaction:
 * - notebook_list, notebook_get, notebook_query
 * - notebook_create, source_add, source_list
 */

import {
  listNotebooks, getNotebook, queryNotebook,
  createNotebook, summarizeNotebook,
} from "../client/notebooks.js";
import { listSources, addUrlSource, addTextSource } from "../client/sources.js";
import { globalQueue } from "../queue/requestQueue.js";
import { formatError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "notebook_list",
    description:
      "List all your NotebookLM notebooks. Returns notebook IDs, titles, and source counts. Use this first to discover available notebooks.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "notebook_get",
    description:
      "Get detailed information about a specific notebook, including all its sources and their status.",
    inputSchema: {
      type: "object",
      properties: {
        notebook_id: {
          type: "string",
          description: "The notebook ID (get this from notebook_list)",
        },
      },
      required: ["notebook_id"],
    },
  },
  {
    name: "notebook_query",
    description:
      "Ask a natural language question to a NotebookLM notebook. The AI will analyze all sources in the notebook and return a grounded, cited answer. This is the main tool for getting information from your notebooks.",
    inputSchema: {
      type: "object",
      properties: {
        notebook_id: {
          type: "string",
          description: "The notebook ID to query",
        },
        query: {
          type: "string",
          description: "Your question in natural language",
        },
      },
      required: ["notebook_id", "query"],
    },
  },
  {
    name: "notebook_create",
    description:
      "Create a new empty NotebookLM notebook. After creating, use source_add to add content.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title for the new notebook",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "source_add",
    description:
      "Add a source to a NotebookLM notebook. Supports URLs (web pages, articles), YouTube videos, and plain text content. The source will be processed and made available for queries.",
    inputSchema: {
      type: "object",
      properties: {
        notebook_id: {
          type: "string",
          description: "The notebook ID to add the source to",
        },
        type: {
          type: "string",
          enum: ["url", "text"],
          description: "Source type: 'url' for web links/YouTube, 'text' for plain text",
        },
        url: {
          type: "string",
          description: "URL to add (for type='url'). Supports web pages and YouTube links.",
        },
        title: {
          type: "string",
          description: "Title for text sources (for type='text')",
        },
        content: {
          type: "string",
          description: "Text content to add (for type='text')",
        },
      },
      required: ["notebook_id", "type"],
    },
  },
  {
    name: "source_list",
    description:
      "List all sources in a NotebookLM notebook, including their titles and processing status (ready, processing, error).",
    inputSchema: {
      type: "object",
      properties: {
        notebook_id: {
          type: "string",
          description: "The notebook ID to list sources for",
        },
      },
      required: ["notebook_id"],
    },
  },
];

export async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  try {
    switch (name) {
      case "notebook_list": {
        const notebooks = await globalQueue.enqueue(() => listNotebooks());
        if (notebooks.length === 0) {
          return text("No notebooks found. Create one with notebook_create or visit https://notebooklm.google.com/");
        }
        const list = notebooks
          .map((n, i) =>
            `${i + 1}. **${n.title}**\n   ID: \`${n.id}\`\n   Sources: ${n.sourceCount}`
          )
          .join("\n\n");
        return text(`Found ${notebooks.length} notebook(s):\n\n${list}`);
      }

      case "notebook_get": {
        const notebookId = args.notebook_id as string;
        if (!notebookId) return text("Error: notebook_id is required.");

        const notebook = await globalQueue.enqueue(() => getNotebook(notebookId));
        if (!notebook) return text(`Notebook not found: ${notebookId}`);

        let result = `**${notebook.title}**\nID: \`${notebook.id}\`\nSources: ${notebook.sourceCount}`;
        if (notebook.sources.length > 0) {
          result += "\n\n**Sources:**";
          for (const src of notebook.sources) {
            const status = src.status ? ` [${src.status}]` : "";
            result += `\n- ${src.title}${status} (ID: \`${src.id}\`)`;
          }
        }
        return text(result);
      }

      case "notebook_query": {
        const notebookId = args.notebook_id as string;
        const query = args.query as string;
        if (!notebookId) return text("Error: notebook_id is required.");
        if (!query) return text("Error: query is required.");

        const result = await globalQueue.enqueue(() =>
          queryNotebook(notebookId, query)
        );

        if (!result.answer) {
          return text("No answer received. The notebook may have no sources, or the query couldn't be answered from the available content.");
        }

        return text(result.answer);
      }

      case "notebook_create": {
        const title = args.title as string;
        if (!title) return text("Error: title is required.");

        const notebook = await globalQueue.enqueue(() => createNotebook(title));
        if (!notebook) return text("Failed to create notebook.");

        return text(`Notebook created!\nTitle: **${notebook.title}**\nID: \`${notebook.id}\`\n\nNext: Use source_add to add content to this notebook.`);
      }

      case "source_add": {
        const notebookId = args.notebook_id as string;
        const type = args.type as string;
        if (!notebookId) return text("Error: notebook_id is required.");
        if (!type) return text("Error: type is required ('url' or 'text').");

        if (type === "url") {
          const url = args.url as string;
          if (!url) return text("Error: url is required for type='url'.");
          await globalQueue.enqueue(() => addUrlSource(notebookId, url));
          const isYt = /youtube\.com|youtu\.be/i.test(url);
          return text(`Source added to notebook!\nType: ${isYt ? "YouTube" : "URL"}\nURL: ${url}\n\nNote: The source may take a moment to process before it's available for queries.`);
        }

        if (type === "text") {
          const title = (args.title as string) || "Untitled";
          const content = args.content as string;
          if (!content) return text("Error: content is required for type='text'.");
          await globalQueue.enqueue(() => addTextSource(notebookId, title, content));
          return text(`Text source added to notebook!\nTitle: ${title}\nLength: ${content.length} characters`);
        }

        return text(`Unknown source type: ${type}. Use 'url' or 'text'.`);
      }

      case "source_list": {
        const notebookId = args.notebook_id as string;
        if (!notebookId) return text("Error: notebook_id is required.");

        const sources = await globalQueue.enqueue(() => listSources(notebookId));
        if (sources.length === 0) {
          return text("No sources in this notebook. Use source_add to add content.");
        }

        const list = sources
          .map((s, i) => {
            const status = s.status ? ` [${s.status}]` : "";
            return `${i + 1}. **${s.title}**${status}\n   ID: \`${s.id}\``;
          })
          .join("\n\n");
        return text(`Found ${sources.length} source(s):\n\n${list}`);
      }

      default:
        return text(`Unknown tool: ${name}`);
    }
  } catch (err) {
    logger.error(`Tool ${name} failed:`, err);
    return text(`Error: ${formatError(err)}`);
  }
}

function text(content: string) {
  return { content: [{ type: "text" as const, text: content }] };
}

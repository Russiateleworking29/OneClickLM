import { listNotebooks, getNotebook, queryNotebook } from "../client/notebooks.js";
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
      "List all NotebookLM notebooks in your Google account. Returns notebook IDs, titles, descriptions, and source counts.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "notebook_get",
    description:
      "Get detailed information about a specific NotebookLM notebook, including its sources.",
    inputSchema: {
      type: "object",
      properties: {
        notebook_id: {
          type: "string",
          description: "The ID of the notebook to retrieve",
        },
      },
      required: ["notebook_id"],
    },
  },
  {
    name: "notebook_query",
    description:
      "Ask a natural language question against a NotebookLM notebook. Returns a sourced, cited answer based on the notebook's sources.",
    inputSchema: {
      type: "object",
      properties: {
        notebook_id: {
          type: "string",
          description: "The ID of the notebook to query",
        },
        query: {
          type: "string",
          description: "The natural language question to ask",
        },
      },
      required: ["notebook_id", "query"],
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
          return text("No notebooks found. Create one at https://notebooklm.google.com/");
        }
        const list = notebooks
          .map(
            (n, i) =>
              `${i + 1}. **${n.title}** (ID: ${n.id})\n   Sources: ${n.sourceCount}${n.description ? `\n   ${n.description}` : ""}`
          )
          .join("\n\n");
        return text(`Found ${notebooks.length} notebook(s):\n\n${list}`);
      }

      case "notebook_get": {
        const notebookId = args.notebook_id as string;
        if (!notebookId) return text("Error: notebook_id is required.");

        const notebook = await globalQueue.enqueue(() => getNotebook(notebookId));
        if (!notebook) return text(`Notebook not found: ${notebookId}`);

        let result = `**${notebook.title}**\nID: ${notebook.id}\nSources: ${notebook.sourceCount}`;
        if (notebook.description) result += `\nDescription: ${notebook.description}`;
        if (notebook.sources.length > 0) {
          result += "\n\nSources:";
          for (const src of notebook.sources) {
            result += `\n- ${src.title} (${src.type})${src.url ? ` — ${src.url}` : ""}`;
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

        let response = result.answer;
        if (result.sources.length > 0) {
          response += "\n\n**Sources:**";
          for (const src of result.sources) {
            response += `\n- ${src.title}`;
            if (src.snippet) response += `: "${src.snippet}"`;
          }
        }
        return text(response);
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

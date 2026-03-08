# OneClickLM — Project Plan

## Vision

The only NotebookLM MCP server that **actually works out of the box**.

Every existing NotebookLM MCP server breaks within days because Google silently rotates `build_label` and CSRF tokens. Users get mysterious 400 errors, stale sessions, and zero guidance on fixing them. OneClickLM solves this permanently with **auto-healing authentication** — no manual token juggling, no Chrome conflicts, no Python dependency hell.

---

## Why This Exists (Pain Points We Solve)

| Problem | Existing tools | OneClickLM |
|---|---|---|
| `build_label` expires every ~2 weeks | 400 errors, manual metadata.json edit | Auto-detects and refreshes on every startup |
| CSRF token goes stale | Silent failures, no error messages | Auto-renews before each session |
| Chrome port conflict on login | "Chrome already running" crash | Headless auth with cookie reuse, no CDP conflicts |
| MCP process dies silently | Queries hang forever, no reconnection | Auto-reconnect with exponential backoff |
| Parallel queries cause timeouts | Concurrent calls crash the server | Built-in request queue with configurable concurrency |
| Python + pipx + profiles | Complex setup, virtualenv issues | `npx oneclicklm` — zero install, runs instantly |
| Poor error messages | Raw stack traces or silent failures | Human-readable errors with fix suggestions |

---

## Competitive Landscape

| Repo | Stars | Language | Key Weakness |
|---|---|---|---|
| PleasePrompto/notebooklm-mcp | ~1,000 | Python | Browser automation overhead, complex setup |
| jacob-bd/notebooklm-mcp-cli | ~200 | Python | build_label bug in auth.py, no auto-reconnect |
| m4yk3ldev/notebooklm-mcp | ~50 | Python | 32 tools but same auth issues |
| **OneClickLM (ours)** | — | TypeScript | Auto-healing auth, zero-config, npx ready |

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                OneClickLM                    │
│                                              │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  │
│  │ Auth     │  │ Request  │  │ MCP       │  │
│  │ Manager  │  │ Queue    │  │ Server    │  │
│  │          │  │          │  │ (stdio)   │  │
│  │ - login  │  │ - serial │  │           │  │
│  │ - refresh│  │ - retry  │  │ - tools   │  │
│  │ - heal   │  │ - timeout│  │ - schemas │  │
│  └──────────┘  └──────────┘  └───────────┘  │
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ Google NotebookLM (batchexecute)     │    │
│  │ - Auto build_label extraction        │    │
│  │ - Auto CSRF token renewal            │    │
│  │ - Cookie-based session persistence   │    │
│  └──────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

---

## MCP Tools (v1.0)

| Tool | Description |
|---|---|
| `notebook_list` | List all notebooks with titles and source counts |
| `notebook_query` | Query a notebook with natural language — returns sourced answer |
| `notebook_get` | Get notebook details (title, description, sources) |
| `notebook_create` | Create a new notebook |
| `source_add` | Add a source (URL, text, file) to a notebook |
| `source_list` | List all sources in a notebook |

---

## Tech Stack

- **Runtime:** Node.js 18+ (TypeScript)
- **MCP SDK:** `@modelcontextprotocol/sdk`
- **Auth:** Puppeteer-core (headless, one-time login) + cookie persistence
- **HTTP:** Native `fetch` for Google batchexecute calls
- **Package:** npm (publishable as `oneclicklm`)
- **Zero dependencies goal:** Minimize external deps for `npx` speed

---

## Implementation Phases

### Phase 1 — Core (Week 1)
- [ ] Google auth flow (headless Puppeteer login → cookie extraction)
- [ ] batchexecute client (notebook_list, notebook_query, notebook_get)
- [ ] Auto build_label extraction from NotebookLM page HTML
- [ ] Auto CSRF token extraction
- [ ] Cookie persistence (~/.oneclicklm/cookies.json)
- [ ] MCP server (stdio transport) with 3 core tools
- [ ] `npx oneclicklm` entry point
- [ ] `oneclicklm login` CLI command

### Phase 2 — Resilience (Week 2)
- [ ] Token auto-refresh on 400/401 errors
- [ ] Request queue (serialize concurrent MCP calls)
- [ ] Auto-reconnect with exponential backoff
- [ ] Human-readable error messages with fix suggestions
- [ ] Health check endpoint / status tool

### Phase 3 — Extended Tools (Week 3)
- [ ] notebook_create
- [ ] source_add (URL, text, file upload)
- [ ] source_list
- [ ] Batch operations (query multiple notebooks)

### Phase 4 — Polish & Launch (Week 4)
- [ ] README with cover image, badges, Before/After
- [ ] IDE-specific install guides (Cursor, Claude Code, VS Code)
- [ ] Demo GIF / video
- [ ] Publish to npm
- [ ] Submit to awesome-mcp-servers lists
- [ ] Submit to Smithery registry

---

## README Structure (for maximum GitHub stars)

```
1. Cover banner image (dark theme, OneClickLM logo)
2. One-liner tagline
3. Cursor/VS Code one-click install badges
4. shields.io badges (npm, license, stars)
5. "The Problem" section (Before — red X list)
6. "The Solution" section (After — green check list)
7. Quick Start (3 lines of code)
8. IDE-specific install (<details> collapsible)
9. Available Tools table
10. Configuration options
11. Comparison table vs competitors
12. Star History chart
13. Contributing guide
14. License (MIT)
```

---

## Key Differentiators for Marketing

1. **"Actually works"** — Every other NotebookLM MCP breaks within weeks. OneClickLM auto-heals.
2. **Zero config** — `npx oneclicklm login` once, then it just works forever.
3. **TypeScript native** — No Python, no virtualenv, no pipx. Just Node.js.
4. **Battle-tested** — Born from production use in BEYOND HUMAN (6-domain AI chatbot platform).
5. **Smart queue** — Won't crash on concurrent queries like every other implementation.

---

## File Structure

```
OneClickLM/
├── src/
│   ├── index.ts          # MCP server entry point
│   ├── auth/
│   │   ├── login.ts      # Puppeteer-based Google login
│   │   ├── tokens.ts     # Token management & auto-refresh
│   │   └── cookies.ts    # Cookie persistence
│   ├── client/
│   │   ├── batchexecute.ts   # Google batchexecute protocol
│   │   ├── notebooks.ts      # Notebook CRUD operations
│   │   └── sources.ts        # Source management
│   ├── mcp/
│   │   ├── server.ts     # MCP server setup
│   │   └── tools.ts      # Tool definitions & handlers
│   ├── queue/
│   │   └── requestQueue.ts   # Serial request queue
│   └── utils/
│       ├── errors.ts     # Human-readable error messages
│       └── logger.ts     # Structured logging
├── bin/
│   └── cli.ts            # CLI entry point (login, status, etc.)
├── assets/
│   └── banner.png        # README cover image
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
└── PLAN.md
```

---

## Launch Checklist

- [ ] Working `npx oneclicklm` with auto-login
- [ ] All 6 MCP tools functional
- [ ] Auto build_label + CSRF refresh
- [ ] README with banner, badges, Before/After, Quick Start
- [ ] Demo GIF showing real usage
- [ ] Published to npm as `oneclicklm`
- [ ] Submitted to awesome-mcp-servers (both repos)
- [ ] Submitted to Smithery registry
- [ ] Posted on Reddit (r/ClaudeAI, r/LocalLLM)
- [ ] Posted on X/Twitter with demo video
- [ ] Hacker News "Show HN" post

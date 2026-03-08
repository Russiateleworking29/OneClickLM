<p align="center">
  <img src="assets/banner.png" alt="OneClickLM" width="800" />
</p>

<h1 align="center">OneClickLM</h1>

<p align="center">
  <strong>The NotebookLM MCP server that actually works.</strong><br>
  Auto-healing auth. Zero config. One command.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oneclicklm"><img src="https://img.shields.io/npm/v/oneclicklm?style=flat-square&color=cb3837" alt="npm" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
  <a href="https://github.com/bravomylife-lab/OneClickLM/stargazers"><img src="https://img.shields.io/github/stars/bravomylife-lab/OneClickLM?style=flat-square&color=yellow" alt="Stars" /></a>
  <a href="https://smithery.ai/server/oneclicklm"><img src="https://img.shields.io/badge/Smithery-Registry-purple?style=flat-square" alt="Smithery" /></a>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#the-problem">The Problem</a> •
  <a href="#available-tools">Tools</a> •
  <a href="#ide-setup">IDE Setup</a> •
  <a href="#comparison">Comparison</a>
</p>

---

## The Problem

Every NotebookLM MCP server on GitHub shares the same fatal flaw: **they break within days.**

Google silently rotates authentication tokens, and existing tools have no idea how to handle it. You get cryptic 400 errors, stale sessions, and hours wasted debugging.

❌ `build_label` expires every 1-2 weeks → **400 Bad Request, no explanation**\
❌ CSRF tokens go stale mid-session → **silent query failures**\
❌ Chrome already running → **login crashes with CDP port conflict**\
❌ Concurrent MCP calls → **timeout cascade, server dies**\
❌ Python + pipx + virtualenv → **30 minutes just to install**\
❌ Connection drops → **queries hang forever, no reconnection**

## The Solution

OneClickLM was built from production pain. After connecting NotebookLM to a 6-domain AI chatbot platform, we hit every possible failure mode and fixed them all.

✅ **Auto-healing auth** — Detects expired tokens and refreshes them before you notice\
✅ **Zero-config startup** — `npx oneclicklm` and you're running\
✅ **No Chrome conflicts** — Headless login with persistent cookies, no CDP required\
✅ **Smart request queue** — Serializes concurrent calls so nothing crashes\
✅ **Auto-reconnect** — Exponential backoff on connection drops\
✅ **TypeScript native** — No Python, no virtualenv, just Node.js

---

## Quick Start

**1. Login (one time only)**

```bash
npx oneclicklm login
```

This opens a browser window for Google sign-in. Your cookies are saved locally — you won't need to do this again.

**2. Add to your MCP client**

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["oneclicklm"]
    }
  }
}
```

**3. Start using it**

```
"List my NotebookLM notebooks"
"Query my Research notebook: What are the key findings?"
"Add this URL as a source to my Project notebook"
```

That's it. No profiles, no metadata.json, no build_label hunting.

---

## Available Tools

| Tool | Description |
|:---|:---|
| `notebook_list` | List all notebooks with titles, descriptions, and source counts |
| `notebook_query` | Ask a question against a notebook — returns a sourced, cited answer |
| `notebook_get` | Get full details of a specific notebook |
| `notebook_create` | Create a new empty notebook |
| `source_add` | Add a source to a notebook (URL, plain text, or file) |
| `source_list` | List all sources within a notebook |

---

## IDE Setup

<details>
<summary><strong>Cursor</strong></summary>

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["oneclicklm"]
    }
  }
}
```

</details>

<details>
<summary><strong>Claude Code (CLI)</strong></summary>

```bash
claude mcp add notebooklm -- npx oneclicklm
```

</details>

<details>
<summary><strong>VS Code (Copilot)</strong></summary>

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "notebooklm": {
      "command": "npx",
      "args": ["oneclicklm"]
    }
  }
}
```

</details>

<details>
<summary><strong>Windsurf</strong></summary>

Add to `~/.windsurf/mcp.json`:

```json
{
  "mcpServers": {
    "notebooklm": {
      "command": "npx",
      "args": ["oneclicklm"]
    }
  }
}
```

</details>

---

<h2 id="comparison">How OneClickLM Compares</h2>

| Feature | OneClickLM | notebooklm-mcp (PleasePrompto) | notebooklm-mcp-cli |
|:---|:---:|:---:|:---:|
| Auto token refresh | ✅ | ❌ | ❌ |
| Auto build_label update | ✅ | ❌ | ❌ |
| Auto-reconnect | ✅ | ❌ | ❌ |
| Request queue | ✅ | ❌ | ❌ |
| Zero-config install | ✅ `npx` | ❌ pipx + profiles | ❌ pipx + profiles |
| Language | TypeScript | Python | Python |
| Chrome conflicts | None | Common | Common |
| Human-readable errors | ✅ | ❌ | ❌ |

---

## Configuration

OneClickLM works with zero configuration. For advanced use cases:

```bash
# Custom config directory
ONECLICKLM_DIR=~/.my-config npx oneclicklm

# Verbose logging
ONECLICKLM_LOG=debug npx oneclicklm

# Custom request timeout (ms)
ONECLICKLM_TIMEOUT=60000 npx oneclicklm
```

Config is stored in `~/.oneclicklm/`:
```
~/.oneclicklm/
├── cookies.json    # Google auth cookies (auto-managed)
├── tokens.json     # CSRF + build_label (auto-refreshed)
└── config.json     # User preferences (optional)
```

---

## How It Works

OneClickLM communicates with Google NotebookLM using the same internal `batchexecute` protocol that the web app uses. The key innovation is the **auto-healing auth layer**:

1. On startup, OneClickLM loads saved cookies and extracts fresh `build_label` + CSRF tokens from the NotebookLM page
2. If tokens are expired, it automatically refreshes them using stored cookies
3. If cookies are expired, it prompts for re-login (once every ~30 days)
4. All requests go through a serial queue to prevent the single-process timeout issue that plagues every other implementation

> [!NOTE]
> OneClickLM uses Google's internal web protocol, not an official API. This means it works with your existing Google account — no API keys, no billing, no quotas. Google AI Pro subscribers get full access to all NotebookLM features.

---

## Troubleshooting

<details>
<summary><strong>Login window doesn't appear</strong></summary>

Make sure you have Chrome or Chromium installed. OneClickLM uses Puppeteer to open a login window.

```bash
# If using a custom Chrome path:
CHROME_PATH=/path/to/chrome npx oneclicklm login
```

</details>

<details>
<summary><strong>Getting 400 errors after weeks of working</strong></summary>

This shouldn't happen with OneClickLM (auto-refresh handles it), but if it does:

```bash
# Force token refresh
npx oneclicklm refresh

# If that doesn't work, re-login
npx oneclicklm login
```

</details>

<details>
<summary><strong>Queries are slow (~20-30 seconds)</strong></summary>

This is normal. NotebookLM processes queries by analyzing your uploaded sources in real-time. The latency comes from Google's servers, not OneClickLM. For reference, the NotebookLM web app has similar response times.

</details>

---

## Contributing

Contributions are welcome! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

```bash
# Clone the repo
git clone https://github.com/bravomylife-lab/OneClickLM.git
cd OneClickLM

# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/index.js
```

---

## Star History

<p align="center">
  <a href="https://star-history.com/#bravomylife-lab/OneClickLM&Date">
    <img src="https://api.star-history.com/svg?repos=bravomylife-lab/OneClickLM&type=Date" width="600" alt="Star History" />
  </a>
</p>

---

## License

MIT © [bravomylife-lab](https://github.com/bravomylife-lab)

---

<p align="center">
  <sub>Built with frustration, fixed with determination.</sub><br>
  <sub>Born from <a href="https://github.com/bravomylife-lab/beyond-human">BEYOND HUMAN</a> — a 6-domain AI chatbot platform powered by NotebookLM.</sub>
</p>

<p align="center">
  <img src="assets/banner.png" alt="OneClickLM" width="800" />
</p>

<h1 align="center">OneClickLM</h1>

<p align="center">
  <strong>The NotebookLM MCP server that actually works.</strong><br>
  Auto-healing auth · Zero config · One command · 6 powerful tools
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/oneclicklm"><img src="https://img.shields.io/npm/v/oneclicklm?style=flat-square&color=cb3837" alt="npm" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
  <a href="https://github.com/bravomylife-lab/OneClickLM/stargazers"><img src="https://img.shields.io/github/stars/bravomylife-lab/OneClickLM?style=flat-square&color=yellow" alt="Stars" /></a>
  <a href="https://smithery.ai/server/oneclicklm"><img src="https://img.shields.io/badge/Smithery-Registry-purple?style=flat-square" alt="Smithery" /></a>
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> ·
  <a href="#-the-problem">The Problem</a> ·
  <a href="#-available-tools">Tools</a> ·
  <a href="#-ide-setup">IDE Setup</a> ·
  <a href="#-comparison">Comparison</a>
</p>

---

## Hi! I'm CR 👋

I built OneClickLM because I was tired of every NotebookLM MCP server breaking on me every few days.

After connecting NotebookLM to a **6-domain AI chatbot platform** ([BEYOND HUMAN](https://github.com/bravomylife-lab/beyond-human)), I hit literally every failure mode — expired tokens, Chrome crashes, concurrent query timeouts, you name it. So I built the tool I wished existed.

**OneClickLM just works.** Login once, forget about it forever.

---

## 💥 The Problem

Every NotebookLM MCP server on GitHub shares the same fatal flaw: **they break within days.**

Google silently rotates auth tokens, and no one handles it.

| What happens | What you see |
|:---|:---|
| `build_label` expires (every 1-2 weeks) | 🔴 400 Bad Request, zero explanation |
| CSRF token goes stale | 🔴 Queries silently fail |
| Chrome already running | 🔴 Login crashes with CDP conflict |
| Two queries at once | 🔴 Timeout cascade, server dies |
| Python + pipx + virtualenv | 🔴 30 minutes just to install |
| Connection drops | 🔴 Queries hang forever |

**Sound familiar?** Yeah, I went through all of this. So you don't have to.

---

## ✅ The Solution

| Feature | How it works |
|:---|:---|
| **Auto-healing auth** | Detects expired tokens → refreshes automatically → you never notice |
| **Zero config** | `npx oneclicklm login` once, then it just works. Forever. |
| **No Chrome conflicts** | Uses system Chrome for login, then pure HTTP. No CDP, no conflicts. |
| **Smart queue** | Serializes concurrent calls. No timeouts, no crashes. |
| **6 powerful tools** | List, query, create notebooks + add sources. Everything you need. |
| **TypeScript native** | No Python, no virtualenv, no pipx. Just Node.js. |

---

## 🚀 Quick Start

**Step 1: Login (one time only)**

```bash
npx oneclicklm login
```

A browser opens → sign in with Google → done. Your cookies are saved locally (~/.oneclicklm/).

**Step 2: Add to your MCP client**

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

**Step 3: Start talking to your notebooks!**

```
"List my NotebookLM notebooks"
"What are the key findings in my Research notebook?"
"Create a new notebook called 'Project Alpha'"
"Add this URL to my notebook: https://example.com/paper.pdf"
```

That's it. No API keys, no profiles, no metadata.json, no build_label hunting.

---

## 🛠 Available Tools

| Tool | What it does | Example prompt |
|:---|:---|:---|
| `notebook_list` | List all your notebooks | "Show me my NotebookLM notebooks" |
| `notebook_get` | Get notebook details + sources | "What sources are in my Research notebook?" |
| `notebook_query` | Ask questions, get cited answers | "What does my notebook say about X?" |
| `notebook_create` | Create a new notebook | "Create a notebook called 'Q1 Report'" |
| `source_add` | Add URL, YouTube, or text sources | "Add this article to my notebook" |
| `source_list` | List all sources + their status | "Show sources in my Project notebook" |

> **Pro tip:** notebook_query uses the same AI (Gemini) as the NotebookLM web app — your answers are grounded in your actual sources with zero hallucination.

---

## 💻 IDE Setup

<details>
<summary><strong>🟢 Cursor</strong></summary>

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
<summary><strong>🟣 Claude Code (CLI)</strong></summary>

```bash
claude mcp add notebooklm -- npx oneclicklm
```

</details>

<details>
<summary><strong>🔵 VS Code (Copilot)</strong></summary>

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
<summary><strong>🟡 Windsurf</strong></summary>

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

## 🔍 How OneClickLM Compares

| Feature | OneClickLM | notebooklm-mcp (Python) | notebooklm-mcp-cli |
|:---|:---:|:---:|:---:|
| Auto token refresh | ✅ | ❌ | ❌ |
| Auto build_label update | ✅ | ❌ | ❌ |
| Auto-reconnect on failure | ✅ | ❌ | ❌ |
| Request queue (no crashes) | ✅ | ❌ | ❌ |
| Zero-config install | ✅ `npx` | ❌ pipx + profiles | ❌ pipx + profiles |
| Language | TypeScript | Python | Python |
| Chrome conflicts | None | Common | Common |
| Human-readable errors | ✅ | ❌ | ❌ |
| Create notebooks via MCP | ✅ | ❌ | ✅ |
| Add sources via MCP | ✅ | ❌ | ✅ |

---

## ⚙️ Configuration

OneClickLM works with **zero configuration**. But if you need it:

```bash
# Custom config directory
ONECLICKLM_DIR=~/.my-config npx oneclicklm

# Debug logging (see what's happening under the hood)
ONECLICKLM_LOG=debug npx oneclicklm

# Custom request timeout (default: 30s, queries may need longer)
ONECLICKLM_TIMEOUT=60000 npx oneclicklm

# Custom Chrome path
CHROME_PATH=/path/to/chrome npx oneclicklm login
```

Config is stored in `~/.oneclicklm/`:
```
~/.oneclicklm/
├── cookies.json    # Google auth cookies (auto-managed)
└── tokens.json     # CSRF + session + build_label (auto-refreshed)
```

---

## 🧠 How It Works (for the curious)

OneClickLM speaks the same language as the NotebookLM web app — Google's internal `batchexecute` RPC protocol.

Here's what happens when you ask a question:

```
You: "What are the key findings?"
 ↓
MCP Client (Cursor/Claude/VS Code) sends tool call
 ↓
OneClickLM checks tokens → auto-refreshes if stale
 ↓
Fetches source IDs from notebook (RPC: rLM1Ne)
 ↓
Sends query via streaming endpoint (GenerateFreeFormStreamed)
 ↓
Parses streaming response → extracts answer
 ↓
Returns grounded, cited answer to your AI
```

**The magic is in the auto-healing auth:**
1. On startup: loads saved cookies + cached tokens
2. If tokens expired (>1 hour): fetches NotebookLM page → extracts fresh `SNlM0e` (CSRF) + `FdrFJe` (session) + `build_label`
3. If cookies expired (~30 days): prompts for re-login
4. If API returns 400/401: auto-refreshes tokens and retries once
5. All requests serialized through a queue → no concurrent crash

> [!NOTE]
> OneClickLM uses Google's internal web protocol, not an official API. This means it works with your existing Google account — no API keys, no billing, no quotas. Google AI Pro subscribers get full NotebookLM access.

---

## 🔧 Troubleshooting

<details>
<summary><strong>Login window doesn't appear</strong></summary>

Make sure Chrome/Chromium is installed. OneClickLM detects it automatically on macOS, Windows, and Linux.

```bash
# If using a non-standard Chrome location:
CHROME_PATH=/path/to/chrome npx oneclicklm login
```

</details>

<details>
<summary><strong>Getting 400/401 errors</strong></summary>

OneClickLM auto-refreshes tokens, but if it persists:

```bash
# Force token refresh
npx oneclicklm refresh

# Nuclear option: re-login
npx oneclicklm login
```

</details>

<details>
<summary><strong>Queries are slow (~15-30 seconds)</strong></summary>

This is **normal**. NotebookLM processes your query against all uploaded sources in real-time (this is the Gemini model working). The NotebookLM web app has similar response times. For faster results, use notebooks with fewer sources.

</details>

<details>
<summary><strong>Check if everything is working</strong></summary>

```bash
npx oneclicklm status
```

This verifies cookies, extracts fresh tokens, and tells you if anything is wrong.

</details>

---

## 🤝 Contributing

Contributions welcome! Bug reports, feature requests, and PRs are all appreciated.

```bash
git clone https://github.com/bravomylife-lab/OneClickLM.git
cd OneClickLM
npm install
npm run build
node dist/src/index.js  # Run locally
```

---

## ⭐ Star History

If OneClickLM saved you from NotebookLM auth hell, consider starring the repo!

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
  <sub>Built with frustration, fixed with determination. 🔥</sub><br>
  <sub>Born from <a href="https://github.com/bravomylife-lab/beyond-human">BEYOND HUMAN</a> — a 6-domain AI chatbot platform powered by NotebookLM.</sub>
</p>

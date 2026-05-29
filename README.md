# CommentASAP

**AI-powered documentation generator and comment remover for VS Code.**
Built in 2 days. Ships with your API key, your data, your control.

---

## What it does

CommentASAP plugs AI into your editing workflow at three scopes:

| Scope | What happens |
|---|---|
| **Selection** | Select any block of code → AI documents it in place |
| **File** | Documents the entire active file, chunked intelligently for large files |
| **Project** | Batch-documents every supported source file in your workspace |

And the reverse — strip all comments from a file or an entire project via AST parsing (not regex hacks).

**Supported languages:** JavaScript · TypeScript · Python · Java · C · C++

---

## Setup (2 steps)

On first install, CommentASAP will walk you through setup automatically.

**Step 1 — Pick a provider**
`Ctrl+Shift+P` → `CommentASAP: Select AI Provider`

Choose from OpenAI, Anthropic, Google Gemini, or OpenRouter.

**Step 2 — Add your API key**
`Ctrl+Shift+P` → `CommentASAP: Configure API Key`

Your key is stored in VS Code's built-in **SecretStorage** — encrypted, local to your machine, never synced, never sent anywhere except directly to the AI provider you chose.

That's it. Right-click code → CommentASAP submenu, or use the Command Palette.

---

## Your API key, your provider, your bill

CommentASAP has **no backend**. Zero. There are no CommentASAP servers. When you generate documentation, the request goes from your machine directly to the AI provider (OpenAI / Anthropic / Google / OpenRouter) under your account.

- CommentASAP never sees your code
- CommentASAP never sees your API key
- CommentASAP has no telemetry, no analytics, no accounts

The only network traffic this extension generates is the API call you explicitly triggered.

---

## AI quality warning

> **The output is only as good as the model you're using.**

Free-tier models and smaller models will produce weaker, sometimes wrong documentation. That is not a bug in CommentASAP — it's a limitation of the underlying model. If you're getting poor results:

- Switch to a stronger model (GPT-4o, Claude Sonnet, Gemini 2.5 Flash)
- Or set a model override in settings (see below)

**Recommended models by provider:**

| Provider | Solid free option | Best results |
|---|---|---|
| OpenAI | `gpt-4o-mini` | `gpt-4o` |
| Anthropic | `claude-haiku-4-5-20251001` | `claude-sonnet-4-20250514` |
| Gemini | `gemini-2.5-flash-preview-05-20` | `gemini-2.5-pro` |
| OpenRouter | `meta-llama/llama-3.3-70b-instruct:free` | any paid model |

---

## Settings

All settings live under `File → Preferences → Settings → CommentASAP`.

### `commentasap.provider`
**Default:** `openai`

Which AI provider to use. Options: `openai` `anthropic` `gemini` `openrouter`

Change this via the Command Palette (`CommentASAP: Select AI Provider`) or edit settings directly.

---

### `commentasap.model`
**Default:** *(blank — uses provider default)*

Override the model. Leave blank to use CommentASAP's default for your chosen provider. Set this if you want to use a specific model version or a cheaper/faster option.

Examples:
```
gpt-4o-mini
claude-haiku-4-5-20251001
gemini-2.5-flash-preview-05-20
meta-llama/llama-3.3-70b-instruct:free
mistralai/mistral-7b-instruct:free
nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
```

OpenRouter model IDs follow the format `org/model-name`. Find the full list at [openrouter.ai/models](https://openrouter.ai/models).

---

### `commentasap.commentStyle`
**Default:** `jsdoc`

Controls the style of generated comments.

| Value | What it does |
|---|---|
| `jsdoc` | JSDoc / docstring-style block comments before each function and class |
| `inline` | Concise inline comments on complex logic only. Won't over-comment obvious lines. |
| `both` | Block comments for functions/classes + inline comments for complex logic |

---

### `commentasap.chunkSize`
**Default:** `80`

Max lines per AI chunk when processing large files. CommentASAP splits files at natural break points (blank lines before function/class declarations) and sends each chunk separately. Lower this if you're hitting token limits; raise it for faster processing on large files.

---

### `commentasap.showDiffPreview`
**Default:** `true`

When enabled, CommentASAP opens a side-by-side diff view (Before ↔ After) before applying any changes. You see exactly what the AI wants to do and choose Apply or Discard.

Set to `false` to skip the preview and apply changes immediately.

---

### `commentasap.skipPatterns`
**Default:** `["node_modules", "dist", ".git", "build", "__pycache__", ".next", "out", "vendor"]`

Folders skipped during project-wide operations. Add your own patterns if you have generated or third-party code you want to exclude.

---

### `commentasap.concurrentFiles`
**Default:** `3`

How many files get processed in parallel during a project-wide operation. Raise this to go faster (uses more API quota). Lower it if you're hitting rate limits.

---

## Safety features

### Diff preview before every change
By default, CommentASAP never silently modifies your code. Every operation — selection, file, project — shows you a diff and asks for confirmation before writing anything. You can review, then Apply or Discard.

### Suspicious output protection
If the AI returns something that looks wrong — output significantly shorter than the input — CommentASAP aborts the operation and tells you, instead of silently overwriting your code with something broken.

Thresholds:
- **File operations:** AI output must be at least 50% the length of the original
- **Selection operations:** AI output must be at least 70% the length of the selection

### Project-wide operations require explicit confirmation
Before touching multiple files, CommentASAP shows a modal with the exact number of files that will be modified and asks you to confirm. No batch operation runs silently.

### Commit before you run

> ⚠️ **Always commit your work to Git before running any project-wide operation.**

CommentASAP modifies files directly. If something goes wrong — bad AI output, model hallucination, whatever — Git is your undo. The extension will remind you of this before project-wide runs, but the responsibility is yours.

### Comment removal uses AST, not regex
When removing comments, CommentASAP uses Tree-sitter's AST parser to identify comment nodes precisely. This means it won't accidentally strip strings that look like comments or mangle code structure. If the Tree-sitter grammar isn't available for a language, it falls back to regex removal and tells you explicitly.

---

## All commands

| Command | Description |
|---|---|
| `CommentASAP: Generate Comments for Selection` | Document selected code |
| `CommentASAP: Generate Comments for File` | Document the full active file |
| `CommentASAP: Generate Comments for Project` | Document all supported files in workspace |
| `CommentASAP: Remove All Comments from File` | Strip all comments (AST-based) |
| `CommentASAP: Remove All Comments from Project` | Strip comments project-wide |
| `CommentASAP: Configure API Key` | Add or update your API key |
| `CommentASAP: Select AI Provider` | Switch between OpenAI / Anthropic / Gemini / OpenRouter |

All commands are also available via right-click in the editor (file + selection operations) and right-click in the Explorer sidebar (project operations).

---

## Frequently asked questions

**Does CommentASAP store or log my code?**
No. Your code goes directly from your machine to your AI provider. CommentASAP is a client-side extension with no servers.

**Can I use a free API key?**
Yes. OpenRouter has genuinely free models. Anthropic, OpenAI, and Google all have free tiers. Results will vary by model quality — see the model recommendations above.

**What if the AI output looks wrong?**
Hit Discard in the diff preview. Nothing gets written. If you already applied and it looks bad, Ctrl+Z (undo) works — CommentASAP uses VS Code's WorkspaceEdit API which is fully undo-safe.

**Python comment removal isn't working well.**
Tree-sitter grammar files for Python/Java/C++ need to be present in the `wasm/` folder. If they're missing, CommentASAP falls back to regex removal and warns you. See the repository for instructions on building grammar files.

**My API key isn't being accepted.**
Double-check the key is for the provider you've selected. Keys don't transfer between providers. Re-run `CommentASAP: Configure API Key` after switching providers.

---

*Built by Parth Panchal · MIT License*
# commentasap — AI Code Documenter

> One-click AI-powered documentation generator and comment remover for VS Code.
> Uses **your own API key** — no data is sent to commentasap servers.

![VS Code](https://img.shields.io/badge/VS%20Code-^1.85.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Features

| Feature | Description |
|---|---|
| **Generate for Selection** | Right-click selected code → add docs instantly |
| **Generate for File** | Document the entire active file with chunked processing |
| **Generate for Project** | Batch-document all source files with concurrency control |
| **Remove Comments (File)** | Strip all comments via AST parsing — no regex hacks |
| **Remove Comments (Project)** | Project-wide comment removal |
| **Diff Preview** | See before/after before any changes are applied |
| **Multi-provider** | OpenAI, Anthropic, or Google Gemini — your choice |
| **Secure Key Storage** | API keys stored in VS Code SecretStorage (encrypted, local) |

---

## Supported Languages

JavaScript · TypeScript · Python · Java · C/C++

---

## Setup

### 1. Install the extension

Search for **commentasap** in the VS Code Marketplace, or install from VSIX:

```bash
code --install-extension commentasap-0.1.0.vsix
```

### 2. Select your AI provider

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) → `commentasap: Select AI Provider`

### 3. Add your API key

`Ctrl+Shift+P` → `commentasap: Configure API Key`

Your key is stored using VS Code's encrypted [SecretStorage](https://code.visualstudio.com/api/references/vscode-api#SecretStorage) — never written to disk in plaintext.

---

## Usage

### Via Command Palette

| Command | What it does |
|---|---|
| `commentasap: Generate Comments for Selection` | Document selected code |
| `commentasap: Generate Comments for File` | Document the full active file |
| `commentasap: Generate Comments for Project` | Document all project files |
| `commentasap: Remove All Comments from File` | Strip all comments (AST-safe) |
| `commentasap: Remove All Comments from Project` | Strip comments project-wide |
| `commentasap: Configure API Key` | Store/update your API key |
| `commentasap: Select AI Provider` | Switch between OpenAI/Anthropic/Gemini |

### Via Right-Click Menu

Right-click in the editor → commentasap submenu for selection and file-level operations.
Right-click in the Explorer → commentasap submenu for project-level operations.

---

## Configuration

All settings available under `File → Preferences → Settings → commentasap`:

| Setting | Default | Description |
|---|---|---|
| `commentasap.provider` | `openai` | AI provider (`openai` / `anthropic` / `gemini`) |
| `commentasap.model` | *(blank)* | Override default model |
| `commentasap.commentStyle` | `jsdoc` | `jsdoc`, `inline`, or `both` |
| `commentasap.chunkSize` | `80` | Max lines per AI chunk |
| `commentasap.skipPatterns` | `[node_modules, dist, ...]` | Folders to skip during project scan |
| `commentasap.showDiffPreview` | `true` | Show diff before applying changes |
| `commentasap.concurrentFiles` | `3` | Files processed concurrently |

---

## Architecture

```
Extension Entry (extension.ts)
    │
    ├── Commands
    │   ├── generateSelection.ts   — selected text → AI → WorkspaceEdit
    │   ├── generateFile.ts        — full file → chunker → AI → WorkspaceEdit
    │   ├── generateProject.ts     — workspace scan → async queue → AI → WorkspaceEdit
    │   ├── removeComments.ts      — AST traversal via Tree-sitter → WorkspaceEdit
    │   └── configure.ts           — API key storage + provider selection
    │
    ├── Providers
    │   └── aiProvider.ts          — OpenAI / Anthropic / Gemini abstraction
    │
    ├── Processor
    │   ├── chunkProcessor.ts      — line-budget chunking with natural break points
    │   └── treeSitterService.ts   — WASM Tree-sitter singleton for comment removal
    │
    ├── Scanner
    │   └── workspaceScanner.ts    — workspace file discovery + language detection
    │
    └── Utils
        ├── diffPreview.ts         — virtual docs + vscode.diff integration
        ├── statusBar.ts           — bottom bar status indicator
        └── workspaceEdit.ts       — WorkspaceEdit helpers + code fence stripper
```

---

## WASM Grammar Files

Tree-sitter requires compiled `.wasm` grammar files. Place them in the `wasm/` folder:

```
wasm/
  tree-sitter-javascript.wasm
  tree-sitter-typescript.wasm
  tree-sitter-python.wasm
  tree-sitter-java.wasm
  tree-sitter-cpp.wasm
  tree-sitter-c.wasm
```

Download from the official Tree-sitter grammar repos (each has a `Releases` page with `.wasm` builds), or build from source:

```bash
npx tree-sitter build-wasm node_modules/tree-sitter-javascript
```

---

## Publishing

```bash
npm install -g @vscode/vsce

# First time
vsce login YOUR_PUBLISHER_ID

# Package locally
vsce package

# Publish
vsce publish

# Publish with version bump
vsce publish patch   # 0.1.0 → 0.1.1
vsce publish minor   # 0.1.0 → 0.2.0
vsce publish major   # 0.1.0 → 1.0.0
```

---

## Development

```bash
git clone https://github.com/YOUR_USERNAME/commentasap
cd commentasap
npm install

# Compile in watch mode
npm run watch

# Press F5 in VS Code to launch the Extension Development Host
```

---

## Privacy

- API keys are stored **only** in VS Code's local encrypted SecretStorage.
- Your code is sent **only** to the AI provider you select, under your account.
- commentasap has no backend, no telemetry, and no accounts.

---

## License

MIT

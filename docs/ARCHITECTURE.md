# Architecture

Anvil is an Electron app with three layers. The rule that shapes everything: **the renderer is a sandboxed web page**. It never touches Node, the filesystem, secrets or the network. Everything privileged happens in the main process, behind one typed contract.

```
┌──────────────────────── Renderer (React 19 + TS, sandboxed) ────────────────────────┐
│ app/        workbench shell: title bar + menus, activity bar, side bar, editor area, │
│             bottom panel, AI pane, status bar, palette, Quick Open, settings         │
│ features/   editor · explorer · search · git · terminal · python · data · viewers   │
│             ai · outline · todos · history · snippets · toolbox · problems · welcome │
│ stores/     Zustand: layout, tabs/groups, ui overlays, workbench bus                 │
└──────────────────── window.anvil (preload: invoke + on, nothing else) ───────────────┘
                                  │  one IPC channel, zod-validated both ways
┌──────────────────────────────── Main process (Node) ────────────────────────────────┐
│ core/       window + security, app:// protocol, IPC router, JSON settings store,     │
│             secrets (safeStorage/DPAPI), workspace + fs guard + watcher, updater     │
│ features/   ai · git · lsp · search · terminal · python · data · history · tasks ·   │
│             templates   (each: activate(ctx) → registers its IPC handlers)           │
└──────────────────────────────────────────────────────────────────────────────────────┘
          │ child processes                                       │ HTTPS
   python / IPython · ruff · pip/uv · basedpyright ·        Anthropic · OpenAI · Gemini ·
   typescript-language-server · ripgrep · git · shells      local Ollama
```

## The IPC contract

`src/shared/ipc/contract.ts` lists every channel. Each domain file in `src/shared/ipc/channels/` declares a zod schema for the input and the output. The main-process router (`core/ipc-router.ts`):

1. rejects calls from any frame that isn't Anvil's own page;
2. validates the input, so a handler never sees malformed data;
3. validates the output, so a bug can't leak unexpected shapes;
4. turns every outcome, including thrown errors, into `Result<T>` = `{ ok, data } | { ok: false, error: { code, message } }`.

Main → renderer events (`fs:changed`, `ai:delta`, `terminal:data`…) are validated before they're sent too. The preload exposes exactly two functions, `invoke(channel, input)` and `on(event, handler)`. There's no generic `ipcRenderer`, and **no channel ever returns a secret**.

## Features (main)

Each feature is a `MainFeature { id, activate(ctx) }`. The context gives it IPC registration, events, namespaced settings, secret _reads_ (main only), the workspace root and a private `userData/features/<id>` folder. Features don't import each other, with one deliberate exception: `python/interpreter.ts` is the shared "which Python" state that the terminal, LSP and data features all follow.

| Feature              | What it does                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai`                 | Streams chat and inline-edit replies (SSE) from Anthropic, OpenAI, Gemini or Ollama. Ghost text is a separate one-shot request. Claude requests use prompt caching and server-side refusal fallbacks. |
| `lsp`                | Spawns basedpyright / typescript-language-server with Electron's own Node and relays JSON-RPC over IPC. Python's server gets the selected interpreter's environment.                                  |
| `terminal`           | node-pty sessions with a scrollback backlog, so a reloaded window reattaches. Fixed presets only: the renderer never supplies a command line to spawn.                                                |
| `python`             | Finds interpreters (venv/uv/conda/system), lists packages, checks tools, formats with ruff, stages REPL cells, builds run commands.                                                                   |
| `data`               | Parses CSV/TSV/JSON(L) in Node. Parquet/Feather/Excel go through the user's Python (polars, then pandas). Results are cached; filter, sort, pages and column stats are served from the cache.         |
| `git`                | simple-git with an allowlisted environment: status, diff, stage, commit, branches, log, blame, HEAD content for gutter markers, and a secret scan of what's staged.                                   |
| `history`            | A snapshot on every save (deduplicated, 50 per file, 30 days), used by the History view.                                                                                                              |
| `search`             | ripgrep: content search, plus the gitignore-aware file list for Quick Open.                                                                                                                           |
| `tasks`, `templates` | Detected runnable tasks, and the "new project" template writer.                                                                                                                                       |

## The renderer

- **Workbench**: fixed regions instead of free docking. Activity bar, a resizable side bar, 1–2 editor groups over a resizable bottom panel, and a resizable AI pane. Sizes and open views persist through `ui:getState` / `ui:setState`.
- **Tabs** (`stores/tabs-store.ts`): each tab has a kind (`code`, `data`, `image`, `notebook`, `markdown`, `diff`, `welcome`). Code tabs point at a text buffer (`features/editor/file-ops.ts`). One Monaco instance per group swaps models in and out, so undo history lives in the model and survives tab switches.
- **Editor extras** attach to each Monaco instance: `# %%` cell decorations, the secret shield, git gutter + blame, bookmarks. Global providers are ghost text, snippets and problems tracking.
- **Commands** (`app/commands/*`) are one list that drives the palette, the menu bar, global shortcuts, and Monaco actions for editor-scoped keys (`scope: 'editor'`, optionally limited to one language).
- **Monaco** is `@codingame/monaco-vscode-api`, i.e. VS Code's editor services. TextMate grammars come from VS Code's built-in extensions and are bundled locally; nothing loads from a CDN.

## Security baseline

- `contextIsolation`, `sandbox`, no `nodeIntegration`, `webSecurity`, and a strict CSP (no `unsafe-eval`; `wasm-unsafe-eval` only, for the TextMate regex engine).
- The app is served from a custom `app://anvil` scheme; navigation away is blocked, and only `https:` links open, in the system browser.
- File access is confined to the open folder (`core/workspace/fs-guard.ts` resolves real paths, so symlinks can't escape).
- Secrets are encrypted with safeStorage (DPAPI) in `secrets.json`. Only declared keys can be stored, and nothing reads them back over IPC.

## Tests

- **Unit** (Vitest, 400+): parsers (CSV, SSE, git log, tasks, TOML sections), the secret scanner, line diff, fuzzy matching, outline, cells, stores, the command registry, the IPC router, the JSON store, history, AI request building.
- **End-to-end** (Playwright driving the real Electron app): security, palette, Quick Open → edit → save → local history, split + outline + cells, the data grid, terminals, commit blocking, and the full AI loop (chat → apply diff → inline edit → ghost text) against a local mock of the Anthropic API.

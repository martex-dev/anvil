# Decisions

Short ADRs: the context, what was decided, and what it costs.

## ADR-001: Built from Forge's editor core

**Context.** Anvil started as the "Build" room of Forge, an all-in-one desktop app (editor + trading desk + ML lab + knowledge hub). Each area is now its own program, so the editor gets to be only an editor.

**Decision.** Keep Forge's proven foundation (Electron security baseline, typed IPC router, safeStorage secrets, workspace/fs guard, VS Code-compatible Monaco with LSP, node-pty terminals, simple-git, ripgrep, streaming AI). Drop the module registry, dockview, SQLite, the Python sidecar and everything trading/lab/hub.

**Consequences.** Mature, tested plumbing from day one. The code still shares shapes with Forge (e.g. `Result<T>`, the contract layout), which is intentional.

## ADR-002: A fixed workbench instead of free docking

**Context.** Forge used dockview so four rooms could each arrange many panels. A code editor has a well-known layout, and free docking mostly adds ways to lose a panel.

**Decision.** Fixed regions (activity bar, side bar, 1–2 editor groups, bottom panel, AI pane), all resizable and collapsible, sizes persisted. Split view covers the "two files side by side" need.

**Consequences.** Simpler code and a predictable UI. You can't float or rearrange panels.

## ADR-003: Settings in a JSON file, not SQLite

**Context.** Settings, UI state and per-folder picks are a few kilobytes. SQLite (better-sqlite3) is a native module that must match Electron's ABI on every upgrade.

**Decision.** `core/store/json-store.ts`: an in-memory map, zod-validated on read (a corrupt value falls back to the default), written atomically (temp file + rename) shortly after changes and on quit. A corrupt file is moved aside instead of blocking startup.

**Consequences.** One less native dependency. Not suitable for large or relational data, which Anvil doesn't have.

## ADR-004: Use the user's Python, never bundle one

**Context.** Forge shipped a ~420 MB PyInstaller sidecar. An editor should run _your_ code with _your_ environment.

**Decision.** Interpreters are discovered (folder `.venv`/`venv`, uv, conda, `py -0p`, PATH) and picked per folder. The REPL, run commands, ruff, pip listing, the language server's site-packages and Parquet reading all use that interpreter, "activated" by environment (PATH/VIRTUAL_ENV/CONDA_PREFIX) rather than by running an activate script, so the PowerShell execution policy never matters.

**Consequences.** A ~130 MB installer, and features match what's installed. Parquet needs polars or pandas+pyarrow in the env, and the viewer says so when they're missing.

## ADR-005: REPL cells via a `_cell(n)` helper

**Context.** Running a `# %%` cell means sending multi-line code to a REPL. Pasting breaks on indentation and prompts. IPython's `%run -i "path"` keeps the quotes on Windows, and userData paths contain spaces ("C:\Users\PC Games\…").

**Decision.** Stage the cell in a file, and load a tiny helper into every Anvil REPL through `PYTHONSTARTUP` (honoured by python and IPython). `_cell(n)` executes the staged file in the REPL's globals. Single lines are typed directly.

**Consequences.** Clean prompts (`In [2]: _cell(1)`), correct tracebacks pointing at the cell file, and no quoting problems. A REPL started outside Anvil doesn't have the helper, which is fine because Anvil only sends cells to its own REPL.

## ADR-006: AI over plain HTTP, several providers, keys in main

**Context.** Chat, inline edit, one-click actions and ghost text, with the user's own keys, and ideally a free local option.

**Decision.** Main talks to the Anthropic, OpenAI and Gemini REST APIs and to Ollama with `fetch` and a small SSE parser (no SDKs), so the provider layer stays symmetric. Chat/edit/commit are streamed. Ghost text is a one-shot request with a `<completion>` protocol, or native fill-in-the-middle on Ollama. Defaults: `claude-opus-5` for chat, `claude-haiku-4-5` for completion. Claude requests set top-level `cache_control` (prompt caching) and, on models that support it, server-side refusal fallbacks. Code changes reach files only through a diff preview or the inline accept/reject step.

**Consequences.** One small, testable module per concern, no SDK churn. New provider features must be added by hand.

## ADR-007: Ghost text is cheap by construction

**Context.** Autocomplete costs a request per pause in typing.

**Decision.** Debounced (350 ms by default, configurable), cancelled when Monaco cancels (you kept typing), skipped mid-word or with code after the cursor, cached for the same position, 200-token cap, prefix/suffix capped at 6k/2k characters. It can be turned off from the status bar.

**Consequences.** Suggestions arrive a beat after you pause, not on every keystroke.

## ADR-008: The secret shield is heuristic and local

**Context.** Crypto and trading code is full of keys: exchange API keys, wallet private keys, keypair JSON files, seed phrases. One leaked commit is expensive.

**Decision.** A shared regex scanner (`src/shared/secret-scan.ts`) runs in the editor (blur + problems) and on `git:scanStaged` before every commit. Rules that look at a value alone are very specific (provider key prefixes, PEM headers, 64-byte keypair arrays, 86–88-char base58). Looser shapes (0x + 64 hex, word lists, generic "password = …") only count next to a telling variable name. Previews are masked. High-severity findings block the commit.

**Consequences.** Some secrets will get past it (it isn't a vault scanner). Transaction hashes and public addresses are deliberately not flagged.

## ADR-009: "Cyber glass" with a performance escape hatch

**Context.** The look calls for blur, glow and translucency. Blur is GPU work, especially over content that repaints.

**Decision.** Glass (`backdrop-filter`) only on chrome panes over a static ambient background. The editor and terminal sit on a near-opaque plate with no blur beneath them. `Settings → Glass: full / subtle / off` and "ambient background" let integrated-GPU laptops opt out. Every color is a token in `tokens.css`.

**Consequences.** It looks the part on a desktop GPU and stays usable on battery.

## ADR-010: Updates from this repo's GitHub Releases

**Context.** The source is public, so the installers can live next to it.

**Decision.** electron-updater reads `martex-dev/anvil` releases. Pushing a `v*` tag builds the NSIS installer on `windows-latest` and publishes it with the workflow's own token. The installer is unsigned; SmartScreen asks once.

**Consequences.** No second repo, no personal access token. Code signing can be added later without changing the flow.

## ADR-011: Themes are CSS palettes, not Monaco themes

**Context.** One look is not enough for an editor you live in all day, and a theme has to recolor the chrome, the editor, the terminal, Code Snap images and preview cards consistently.

**Decision.** A theme is one `[data-theme='id']` block in `themes.css` that defines the whole palette: surfaces, glass, text, semantic colors, the theme's accent pair and 14 `--syn-*` syntax colors. `tokens.css` derives everything else (soft fills, glows, shadows) per `[data-theme]` scope, so a card with its own `data-theme` renders that theme inside a differently themed app. Monaco keeps VS Code's Default Dark/Light Modern as a base and is restyled through user settings (`workbench.colorCustomizations`, TextMate rules and semantic-token rules) built from the live tokens. xterm reads the same tokens. The accent is the theme's own unless a preset or custom color is chosen. A unit test checks that every theme defines every variable and meets contrast minimums.

**Consequences.** Adding a theme is a CSS block and one line of metadata, with no JS color tables. Every theme change re-tokenizes open files. Monaco's TextMate worker occasionally logs a harmless `tokenizeEncoded` error while that happens (an upstream race; highlighting stays correct), and refreshes are debounced to keep it rare.

## ADR-012: Bundled coding fonts

**Context.** The code font is personal, and a desktop app can't assume anything beyond Consolas is installed.

**Decision.** Nine fonts ship with the app through `@fontsource` packages (JetBrains Mono, Fira Code, Cascadia Code, Geist Mono, Monaspace Neon, Maple Mono, Victor Mono, Iosevka, IBM Plex Mono). Only the Latin 400/700 and italic subsets are used, declared in `styles/fonts.css` as woff2 only (the packages' own stylesheets also pull in `.woff` fallbacks that Chromium never needs). They are dev dependencies because Vite copies the files into the build.

**Consequences.** About 3.7 MB more in the installer (3 MB of it is Iosevka, which has an unusually large glyph set), with no network access and no install step. Fonts that aren't selected are never loaded.

## ADR-013: The scratchpad holds its own model reference

**Context.** The scratchpad is an `inmemory:` Monaco model (it is not a file). In VS Code's services, when any feature (hover, peek, the language client) takes a reference to an `inmemory:` model and releases it, `TextResourceEditorModel` destroys the model, which left an empty editor after a few cursor moves.

**Decision.** `openScratch` takes a reference through `ITextModelService` and keeps it until the tab closes. Closing flushes the text to local storage first.

**Consequences.** The scratchpad lives exactly as long as its tab. Any future in-memory buffer (untitled files, AI previews that are real editors) needs the same treatment.

## ADR-014: The data viewer works in a worker thread

**Context.** The data viewer parses up to 200 MB of CSV/JSON and filters, sorts and profiles up to a million rows. Done inside IPC handlers, that ran on Electron's main process, so opening a big file, typing a filter or clicking a column header froze windows, menus, terminals and every other IPC call for seconds.

**Decision.** The data feature keeps its tables in a `node:worker_threads` worker (`features/data/worker.ts`, bundled by electron-vite's `?modulePath` import). The main thread only validates the request (workspace, path guard, format, which Python) and forwards it; `DataWorkerClient` matches replies to requests, turns error codes back into `AnvilError`s, and restarts the worker on the next call if it dies. The worker file is unpacked from `app.asar` so Node can always load it.

**Consequences.** The UI stays responsive whatever the file size, and a worker crash (for example out of memory) fails only the pending data requests. Requests are copied between threads (structured clone), which is cheap for pages and stats but means the worker must stay free of Electron imports: it only uses Node built-ins and pure modules.

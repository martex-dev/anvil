# CLAUDE.md: Anvil

> An AI code editor for quant, trading, crypto, ML and data-science work in Python (and TS).
> Owner: Marto. Windows 11 first. Built with Claude Code. Public repo: martex-dev/anvil.

## 1. What Anvil is (and isn't)

A focused code editor: Monaco + language servers + terminals + git + AI, tuned for Python research loops (`# %%` cells in a REPL, data files in a grid, look-ahead-bias checks). It does **not** fetch market data, trade, or embed other apps. Those live in separate programs.

**Guiding principle:** every feature must make writing or running code faster. No generic features for completeness. When a requirement is unclear, ask.

## 2. Stack (don't change without asking; record choices in `docs/DECISIONS.md`)

- Electron (pinned) via electron-vite; electron-builder NSIS; electron-updater from this repo's Releases
- React 19 + TypeScript strict + Vite; Tailwind v4 with tokens only (`src/renderer/styles/themes.css` + `tokens.css`)
- Radix primitives, lucide-react icons, cmdk (palette, Quick Open, quick picks)
- Zustand (UI state) + TanStack Query (IPC data)
- Monaco = `@codingame/monaco-vscode-api` (bundled, never a CDN) + monaco-languageclient → basedpyright, typescript-language-server
- xterm.js + node-pty; simple-git; @vscode/ripgrep; zod for every IPC payload and setting
- Tests: Vitest (unit), Playwright for Electron (e2e)

## 3. Architecture rules

- The renderer never touches Node, the filesystem, secrets or the network. Everything privileged goes through `window.anvil.invoke`.
- Every channel is declared once in `src/shared/ipc/channels/*` with zod input/output schemas and spread into `contract.ts`. Handlers return data or throw `AnvilError(code, message)`; the router wraps it in `Result<T>`.
- Main features live in `src/main/features/<id>/index.ts` as `MainFeature { id, activate(ctx) }` and are listed in `src/main/index.ts`. Features don't import each other (exception: `python/interpreter.ts`, the shared "which Python" state).
- Renderer features live in `src/renderer/features/<id>/`. Commands are plain lists (`commands.ts`) aggregated in `app/commands/all.ts`. A command is global, or `scope: 'editor'` (a Monaco action, optionally `editorLanguage`).
- Secrets: only keys declared in `src/shared/secrets.ts`; never returned over IPC, logged, or put in errors. Never ask Marto to paste a key into chat; point to Settings → API Keys.
- Python always comes from the user's environment (ADR-004). Anvil ships no Python.

## 4. Commands

```
npm install
node node_modules/electron/install.js
npm run dev            # app with hot reload (F12 devtools)
npm run lint           # eslint
npm run format         # prettier --write
npm run typecheck      # tsc: node, web, e2e
npm test               # vitest
npm run test:e2e       # build + playwright
npm run dist           # NSIS installer in release/
npx tsx scripts/readme-shots.mts <demo-folder> docs/screenshots   # README images (mock AI)
npx tsx scripts/skin-shots.mts <demo-folder> <out-dir> [skin:palette,...] [--extras]
```

Run lint, typecheck, unit and e2e tests before every commit.

## 5. Design system: "cyber glass"

- Near-black background with an ambient glow + drifting grid (`.ambient`); floating panes are `.glass` (blur + translucency + a neon hairline edge). Overlays are `.glass-strong`.
- **Themes** (ADR-011): each theme is one `[data-theme='id']` block in `themes.css` defining the full palette (surfaces, text, semantic, `--theme-accent(-2)`, `--syn-*`), plus an entry in `theme-list.ts`; `themes.test.ts` keeps them in sync and checks contrast. Derived tokens (`--accent-soft`, glows) are recomputed per `[data-theme]` scope in `tokens.css`, so a nested `data-theme` (preview cards) shows that theme.
- One accent (`--accent`) plus a partner hue (`--accent-2`): the theme's own by default, or a preset / custom color via `<html data-accent>`. The syntax theme uses the `--syn-*` tokens; Monaco and xterm rebuild on the `anvil:appearance` event.
- Type: Geist Sans for UI (13px base); the code font is a setting (nine bundled, `--font-code`); numbers use `.num`, micro-labels mono uppercase `.hud`.
- **No raw colors outside `themes.css` and `tokens.css`.** Use Tailwind token classes or `var(--token)`; Monaco and xterm resolve tokens via `resolveToken`.
- Every view has designed loading, empty and error states. Everything is reachable from the palette. Visible focus rings; respect reduced motion.
- Performance: no `backdrop-filter` under Monaco or xterm. `Settings → Glass: off` must stay fully usable.

## 6. Code style

- **Tabs, single quotes** (incl. JSX), semicolons, trailing commas, print width 100 (Prettier).
- TS strict + `noUncheckedIndexedAccess`; no `any`, no non-null `!` (lint enforces it). Explicit return types on exports.
- `PascalCase.tsx` for components (one per file), `kebab-case.ts` otherwise; files under ~300 lines.
- Comments explain *why*. Never swallow errors: log in main (electron-log), and show user-relevant ones as toasts or view error states.
- React: follow the react-hooks lint rules (no setState in effects, no refs during render). Derive state during render instead.

## 7. Working in this repo

1. Read this file first. For anything beyond a small change, write a short plan (goal, files, risks).
2. Explain new concepts briefly (Marto is learning), then build complete solutions, with no placeholders.
3. Be direct: point out trade-offs and push back on bad ideas.
4. Small Conventional Commits (`feat(python): …`), all checks green. Justify every new dependency in the commit message.
5. Keep `docs/` current: add an ADR for any non-obvious decision.
6. Windows first: `path.join`, PowerShell commands, and quote paths (this machine's user folder has a space).
7. End-of-task report: what changed, how to verify, known limitations, what's next.

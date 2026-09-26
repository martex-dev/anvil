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

## 5. Design system: skins

- Anvil has **skins** (ADR-014): whole looks that differ in layout, chrome, fonts, icons, shape and effects, each with 4+ color variants. Cyber Glass is the default. Everything about writing one is in `docs/SKINS.md`.
- A skin is a folder `src/renderer/skins/<id>/` (manifest.ts, palettes.css, skin.css, optional icons.tsx / chrome.tsx / preview.webp), discovered by glob. Never add a skin to a shared list.
- Palettes: one `[data-theme='id']` block each with every required variable (plus optional `--skin-*` extras); `skins/palettes.test.ts` enforces it and checks contrast. Derived tokens (`--accent-soft`, glows) are recomputed per `[data-theme]` scope in `tokens.css`.
- Shared chrome carries `data-part` hooks; skins restyle through them (scoped to `html[data-skin='id']`) or replace chrome through `SkinChrome` slots. Shape (`--r-*`), fonts (`--font-ui/-display/-code`), density (`--spacing`) and effects (`data-fx`) are variables and attributes on `<html>`.
- `resolveLook(settings)` is the single place that turns settings into skin + palette + fonts + layout; `applyAppearance` writes it to `<html>` and `useLook()` reads it (previews included). Monaco and xterm rebuild on the `anvil:appearance` event.
- **No raw colors outside palettes.css files and `tokens.css`.** Use Tailwind token classes, `var(--token)` or `color-mix`.
- Every view has designed loading, empty and error states. Everything is reachable from the palette. Visible focus rings; respect reduced motion (it also calms skin effects).
- Performance: no `backdrop-filter` under Monaco or xterm; skin effects animate transform/opacity only and switch off with `data-fx='off'`.

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

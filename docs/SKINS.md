# Skins

A **skin** is a whole look for Anvil: layout, chrome, fonts, icons, shapes, effects and a set of
color variants. Two skins should feel like two different programs. Inside a skin the user picks a
**color variant** (palette), an **interface font**, the **code font**, **density**, **effects**
level and which side the side bar sits on.

Skins are discovered automatically: adding one never means editing a shared file.

```
src/renderer/skins/<id>/
  manifest.ts     required  data only (no React): name, palettes, fonts, layout
  palettes.css    required  one [data-theme='<palette-id>'] block per palette
  skin.css        usually   everything visual, scoped to html[data-skin='<id>']
  icons.tsx       optional  the skin's own chrome icons (default export: IconSet)
  chrome.tsx      optional  replacement chrome components (default export: SkinChrome)
  preview.webp    optional  gallery thumbnail (scripts/make_previews.py)
```

Every `*.css` file in a skin folder is loaded at startup; scope every rule so it only matches
while the skin is active.

## manifest.ts

```ts
import type { SkinManifest } from '../types';

const mainframe: SkinManifest = {
	id: 'mainframe',
	name: 'Mainframe',
	tagline: 'A terminal program: box-drawn panes, F-keys, phosphor glow.',
	order: 1,
	defaultPalette: 'mf-green',
	palettes: [{ id: 'mf-green', name: 'P1 Green', kind: 'dark', description: '...' }],
	fonts: {
		ui: ['vt323', 'plex-mono', 'share-tech'], // ids from src/shared/fonts.ts UI_FONTS
		display: "'VT323', monospace", // headings and .hud labels
		code: 'plex', // id from EDITOR_FONTS
	},
	layout: {
		activity: 'top', // 'left' | 'right' | 'top' | 'rail'
		activityLabels: true, // text labels in the views switcher
		sidebar: 'left', // 'left' | 'right' | 'drawer'
		statusBar: 'bottom', // 'top' | 'bottom'
		gap: 0, // px between panes; 0 = tiled
		// editorColumn: 760,     // center code in a column this wide
	},
};
export default mainframe;
```

- Palette ids are global: prefix them with a short skin code (`mf-green`).
- Fonts must come from `src/shared/fonts.ts` (bundled woff2, see `scripts/gen_fonts.py`).
  Adding a font means a new `@fontsource` dev dependency; ask first.

## palettes.css

One block per palette, selector exactly `[data-theme='<id>']`, `color-scheme` matching `kind`,
and every required variable. The palette test (`skins/palettes.test.ts`) enforces this, plus WCAG
contrast for text on `--bg-1`.

Required: `--bg-0..3`, `--border`, `--border-strong`, `--glass`, `--glass-strong`,
`--glass-edge`, `--glass-highlight`, `--editor-bg`, `--scrim`, `--text-0..2`, `--up`, `--down`,
`--warn`, `--info`, `--theme-accent`, `--theme-accent-2`, `--on-accent`, and 14 syntax colors
`--syn-comment|keyword|control|string|number|function|type|variable|parameter|property|
decorator|builtin|operator|regexp`.

- Values: `#rrggbb` or `rgb(r g b / a)` only.
- Extra colors a skin needs (bevel light/shadow, CRT glow, paper grain) go in the same block as
  `--skin-<name>` variables. **Raw colors live only in palettes.css** (and tokens.css); skin.css
  uses `var(...)` and `color-mix(...)`.
- `--glass*` need not be translucent: a solid skin sets them to its panel color.
- Syntax colors drive Monaco (TextMate and semantic tokens) and the terminal automatically.

## skin.css

Scope every selector with `html[data-skin='<id>']`. Useful levers:

| Lever         | How                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| Corner radius | set `--r-sm`, `--r-md`, `--r-lg`, `--r-xl` on `html[data-skin='<id>']` (every `rounded-*` follows)           |
| Fonts         | the manifest sets `--font-ui`, `--font-display`, `--font-code`; `.hud` labels use the display font           |
| Panes         | `.glass` (every pane), `.glass-strong` (menus, dialogs, pickers), `.glass::before` (Cyber hairline; hide it) |
| Background    | `.ambient` (Cyber's backdrop; hide it) or a `Backdrop` component in chrome.tsx                               |
| Lucide icons  | `svg.lucide { stroke-width: 2.5; stroke-linecap: square }` restyles all content icons                        |
| Density       | leave spacing to the user's density setting                                                                  |
| Effects       | `html[data-fx='off']` = no decoration or animation, `'subtle'` = static decoration only                      |
| Light/dark    | `html[data-kind='light'                                                                                      | 'dark']` if a variant needs different treatment |

### Style hooks (`data-part`)

Shell and panes: `shell`, `workbench`, `titlebar`, `brand`, `menubar`, `menu-trigger`,
`command-center`, `title-actions`, `window-controls`, `window-button` (+ `data-action=
minimize|maximize|close`), `statusbar`, `status-item`, `splitter` (+ `data-axis`),
`splitter-handle`, `pane-gap`.

Views switcher: `activity` (+ `data-orientation`, `data-placement`), `activity-row`,
`activity-rail`, `activity-item` (+ `data-view`, `data-index` 1-9, `data-active`),
`activity-label`, `activity-badge`, `activity-marker`, `activity-spacer`.

Side bar and panel: `sidebar-slot`, `sidebar` (+ `data-view`), `drawer`, `drawer-backdrop`,
`pane-header`, `pane-index`, `pane-rule`, `pane-title`, `pane-body`, `panel`, `panel-tab`
(+ `data-active`), `terminal-chip`, `chat`.

Editor: `editor-column`, `editor-group` (+ `data-focused`), `tabbar`, `tab` (+ `data-active`),
`tab-marker`, `editor-surface`.

Examples: `[data-part='activity-item']::before { content: 'F' attr(data-index); }` prints F-key
hints; `[data-part='pane-title']::before { content: '┌─ '; }` box-draws a pane title.

### Don'ts

- Don't style Monaco's internals beyond what the palette already does (it re-themes itself from
  the palette on every change).
- Don't put `backdrop-filter` under the editor or terminal (it repaints on every keystroke).
- Keep text at WCAG AA, focus rings visible, and every control reachable.
- Effects must switch off with `data-fx='off'` and never block pointer events.

## chrome.tsx (optional)

Replace whole pieces of chrome. Default export a `SkinChrome`:

| Slot             | Replaces                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| `TitleBar`       | the title bar (include `<WindowControls />` or your own buttons)                                         |
| `WindowControls` | minimize / maximize / close (use `windowActions` and `useWindowState` from `app/hooks/use-window-state`) |
| `ActivityBar`    | the views switcher (placed where `layout.activity` says)                                                 |
| `StatusBar`      | the status bar                                                                                           |
| `Top`            | an extra bar under the title bar (command line, window list)                                             |
| `Bottom`         | an extra bar at the very bottom (F-key bar, taskbar)                                                     |
| `Backdrop`       | the background layer behind the panes                                                                    |
| `Overlay`        | a layer above everything (`pointer-events: none`): scanlines, vignette, grain                            |

Reuse the shared pieces where you can: `app/TitleBar`, `app/ActivityBar`, `app/StatusBar`,
`app/WindowControls`, `useLayoutStore`, `runCommandById`, `shortcutFor`, `useWorkspace`,
`SkinIcon`. Replacement chrome must stay keyboard accessible and must drag the window where a
title bar would (`className='drag'`, with `no-drag` on buttons).

## icons.tsx (optional)

Default export an `IconSet`: components for any `ChromeIconName` (`explorer`, `search`, `git`,
`run`, `outline`, `todos`, `history`, `snippets`, `toolbox`, `ai`, `settings`, `terminal`,
`problems`, `play`, `close`, `plus`, `split`, `menu`, `sidebar`, `panel`, `minimize`,
`maximize`, `restore`, `palette`). Each gets `{ size, className }`, draws with `currentColor`,
and is `aria-hidden`. Missing names fall back to lucide.

## Checking a skin

```
npx vitest run src/renderer/skins          # palettes, manifest
npm run typecheck && npm run lint
npm run build
npx tsx scripts/skin-shots.mts <demo-folder> <out-dir> <id>:*   # every palette of the skin
python scripts/make_previews.py <out-dir> <id>                   # gallery thumbnail
```

Look at every screenshot: the side bar, tabs, editor, panel, chat, status bar and dialogs must
all read well in every palette.

import type { ITheme } from '@xterm/xterm';

import { resolveToken } from '../../lib/resolve-color';

/** xterm theme from the active theme's tokens (ANSI hues borrow its syntax colors). */
export function buildXtermTheme(): ITheme {
	const c = resolveToken;
	return {
		// Opaque (xterm drops the token's alpha without allowTransparency): a transparent canvas
		// would composite every repaint over the glass pane's backdrop-filter.
		background: c('--editor-bg'),
		foreground: c('--text-0'),
		// The editor's caret color: the terminal sits on the same paper (--editor-bg).
		cursor: c('--editor-accent'),
		cursorAccent: c('--bg-1'),
		selectionBackground: c('--accent-soft'),
		black: c('--bg-3'),
		red: c('--down'),
		green: c('--up'),
		yellow: c('--warn'),
		blue: c('--info'),
		magenta: c('--syn-keyword'),
		cyan: c('--syn-function'),
		white: c('--text-1'),
		brightBlack: c('--text-2'),
		brightRed: c('--down'),
		brightGreen: c('--syn-string'),
		brightYellow: c('--syn-number'),
		brightBlue: c('--info'),
		brightMagenta: c('--syn-control'),
		brightCyan: c('--syn-type'),
		brightWhite: c('--text-0'),
	};
}

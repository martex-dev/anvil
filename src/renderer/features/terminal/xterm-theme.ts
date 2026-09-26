import type { ITheme } from '@xterm/xterm';

import { resolveToken } from '../../lib/resolve-color';

/** xterm theme from design tokens; transparent so the glass pane shows through. */
export function buildXtermTheme(): ITheme {
	const c = resolveToken;
	return {
		background: '#00000000',
		foreground: c('--text-0'),
		cursor: c('--accent'),
		cursorAccent: c('--bg-1'),
		selectionBackground: c('--accent-soft'),
		black: c('--bg-3'),
		red: c('--down'),
		green: c('--up'),
		yellow: c('--warn'),
		blue: c('--info'),
		magenta: c('--accent-magenta'),
		cyan: c('--accent-cyan'),
		white: c('--text-1'),
		brightBlack: c('--text-2'),
		brightRed: c('--down'),
		brightGreen: c('--accent-lime'),
		brightYellow: c('--accent-amber'),
		brightBlue: c('--info'),
		brightMagenta: c('--accent-violet'),
		brightCyan: c('--accent-cyan'),
		brightWhite: c('--text-0'),
	};
}

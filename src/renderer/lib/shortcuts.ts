export interface ParsedShortcut {
	ctrl: boolean;
	shift: boolean;
	alt: boolean;
	key: string;
}

/** Parses "Ctrl+Shift+P" style strings. Keys are compared lower-case; "Ctrl++" means plus. */
export function parseShortcut(shortcut: string): ParsedShortcut {
	const parts = shortcut
		.replace(/\+\+$/, '+plus')
		.split('+')
		.map((p) => p.trim().toLowerCase());
	const key = parts[parts.length - 1] ?? '';
	return {
		ctrl: parts.includes('ctrl'),
		shift: parts.includes('shift'),
		alt: parts.includes('alt'),
		key: key === 'plus' ? '+' : key,
	};
}

interface KeyLike {
	key: string;
	code?: string;
	ctrlKey: boolean;
	metaKey?: boolean;
	shiftKey: boolean;
	altKey: boolean;
	getModifierState?: (key: 'AltGraph') => boolean;
}

/**
 * AltGr arrives on Windows as Ctrl+Alt, and on many layouts it types a character (Polish ś is
 * AltGr+S, ł is AltGr+L). Such a keystroke is text, never a Ctrl+Alt shortcut.
 */
export function isAltGraph(event: Pick<KeyLike, 'getModifierState'>): boolean {
	return event.getModifierState?.('AltGraph') ?? false;
}

const CODE_ALIASES: Record<string, string> = {
	'`': 'backquote',
	',': 'comma',
	'.': 'period',
	'/': 'slash',
	'\\': 'backslash',
	'[': 'bracketleft',
	']': 'bracketright',
	'=': 'equal',
	'-': 'minus',
	';': 'semicolon',
};

export function matchesShortcut(event: KeyLike, shortcut: string): boolean {
	if (isAltGraph(event)) return false;
	const s = parseShortcut(shortcut);
	const ctrl = event.ctrlKey || Boolean(event.metaKey);
	if (ctrl !== s.ctrl || event.shiftKey !== s.shift || event.altKey !== s.alt) return false;
	// Shift changes `key` for digits/punctuation ("!" for 1), so fall back to the physical code.
	const key = event.key.toLowerCase();
	if (key === s.key) return true;
	if (event.code) {
		const code = event.code.toLowerCase();
		return (
			code === `key${s.key}` ||
			code === `digit${s.key}` ||
			(CODE_ALIASES[s.key] !== undefined && code === CODE_ALIASES[s.key])
		);
	}
	return false;
}

/** Function keys may be bound without modifiers; everything else needs Ctrl or Alt. */
export function isBindable(shortcut: string): boolean {
	const s = parseShortcut(shortcut);
	return s.ctrl || s.alt || /^f\d{1,2}$/.test(s.key);
}

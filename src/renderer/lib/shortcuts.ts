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

export interface KeyLike {
	key: string;
	code?: string;
	ctrlKey: boolean;
	metaKey?: boolean;
	shiftKey: boolean;
	altKey: boolean;
	// Method syntax so React's narrower (key: ModifierKey) signature is accepted too.
	getModifierState?(key: string): boolean;
}

/** A single printable ASCII character: a letter, digit, punctuation or space. */
const PRINTABLE_ASCII = /^[\x20-\x7e]$/;
const ASCII_ALNUM = /^[a-z0-9]$/i;
const LETTER_OR_DIGIT_KEY = /^(Key[A-Z]|Digit\d)$/;

/**
 * Whether Ctrl+Alt typed a character. Windows turns the left Ctrl+Alt into AltGr as well, and
 * Chromium sets the AltGraph flag only for the right Alt key, so the character itself decides.
 */
function typesAltGrCharacter(event: KeyLike): boolean {
	if (!event.ctrlKey || !event.altKey || [...event.key].length !== 1) return false;
	const key = event.key;
	// Ctrl+Alt+S reports a plain "s": that's the shortcut.
	if (ASCII_ALNUM.test(key)) return false;
	// Cyrillic or Greek layouts have no AltGr layer and report their own letter; the physical key
	// then picks the shortcut (see shortcutMatchRank).
	if (/\p{L}/u.test(key) && !/\p{Script=Latin}/u.test(key)) return false;
	// Polish ś ż ń ć, German € µ, Czech ě: text.
	if (!PRINTABLE_ASCII.test(key)) return true;
	// ASCII symbols on a letter or digit key are the AltGr layer (Czech AltGr+B is "{", Swedish
	// AltGr+7 is "{"). With Shift held it's the layout's shifted symbol instead (German Shift+7
	// is "/"), and a punctuation key's own symbol (US Ctrl+Alt+/) is a real shortcut.
	return !event.shiftKey && LETTER_OR_DIGIT_KEY.test(event.code ?? '');
}

/**
 * AltGr arrives on Windows as Ctrl+Alt, and on many layouts it types a character (Polish ś is
 * AltGr+S, ł is AltGr+L, Czech @ is AltGr+V). Such a keystroke is text, never a Ctrl+Alt
 * shortcut.
 */
export function isAltGraph(event: KeyLike): boolean {
	return (event.getModifierState?.('AltGraph') ?? false) || typesAltGrCharacter(event);
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

/**
 * How well a key event matches a shortcut: 0 no match, 3 the printed key with exact modifiers,
 * 2 the printed symbol plus the Shift the layout needs to type it, 1 the physical key. Callers
 * pick the best match, so a layout where the printed and physical keys disagree never runs both.
 * AltGr is not checked here (see `matchesShortcut`).
 */
export function shortcutMatchRank(event: KeyLike, shortcut: string): number {
	const s = parseShortcut(shortcut);
	const ctrl = event.ctrlKey || Boolean(event.metaKey);
	if (ctrl !== s.ctrl || event.altKey !== s.alt) return 0;
	const key = event.key.toLowerCase();
	if (key === s.key) {
		if (event.shiftKey === s.shift) return 3;
		// German types "/" as Shift+7 and US types "+" as Shift+=: when the printed symbol is the
		// one the shortcut names, Shift was only needed to type it, so Ctrl+Alt+/ stays reachable.
		const symbol = s.key.length === 1 && !ASCII_ALNUM.test(s.key);
		return symbol && event.shiftKey && !s.shift ? 2 : 0;
	}
	if (event.shiftKey !== s.shift || !event.code) return 0;
	const code = event.code.toLowerCase();
	const printable = PRINTABLE_ASCII.test(event.key);
	// Letters use the physical key only on non-Latin layouts (Cyrillic, Greek). On AZERTY or
	// Dvorak the key prints another ASCII letter, and that letter wins: AZERTY's Ctrl+Z sits on
	// the physical W and must stay Undo, not Close Tab.
	if (/^[a-z]$/.test(s.key)) return code === `key${s.key}` && !printable ? 1 : 0;
	// The digit row is the digit row on every layout, but AZERTY prints &é"' there unshifted and
	// Shift turns 1 into ! on US. Only a key that prints another letter or digit disagrees.
	if (/^[0-9]$/.test(s.key)) {
		return code === `digit${s.key}` && !ASCII_ALNUM.test(event.key) ? 1 : 0;
	}
	// Punctuation moves around between layouts (the US / key prints - on German), so trust the
	// physical key only when the printed one is no help: non-ASCII (ö), a dead key, or the
	// shifted form of the key when the shortcut itself asks for Shift (~ for Ctrl+Shift+`).
	const alias = CODE_ALIASES[s.key];
	if (alias === undefined || code !== alias) return 0;
	return !printable || (s.shift && event.shiftKey) ? 1 : 0;
}

export function matchesShortcut(event: KeyLike, shortcut: string): boolean {
	// AltGr reports Ctrl+Alt on Windows; it types characters (ż, ś, @, }), never a shortcut.
	if (isAltGraph(event)) return false;
	return shortcutMatchRank(event, shortcut) > 0;
}

/** Function keys may be bound without modifiers; everything else needs Ctrl or Alt. */
export function isBindable(shortcut: string): boolean {
	const s = parseShortcut(shortcut);
	return s.ctrl || s.alt || /^f\d{1,2}$/.test(s.key);
}

/** What a key event means to the terminal before xterm sees it. */
export type TerminalKeyAction = 'copy' | 'native-paste' | 'xterm';

type KeyInfo = Pick<KeyboardEvent, 'type' | 'key' | 'code' | 'ctrlKey' | 'shiftKey' | 'altKey'>;

/**
 * The letter a shortcut was typed with, case-insensitive (Caps Lock) and by physical key when the
 * layout doesn't produce a Latin letter (Ctrl+C on a Cyrillic layout still copies).
 */
function letter(e: KeyInfo): string {
	if (/^[a-z]$/i.test(e.key)) return e.key.toLowerCase();
	return /^Key[A-Z]$/.test(e.code) ? e.code.slice(3).toLowerCase() : '';
}

/**
 * Ctrl+C (and Ctrl+Shift+C, the Windows Terminal habit) copies when text is selected; without a
 * selection Ctrl+C is SIGINT. Ctrl+V is left to the browser's native paste. Everything else,
 * including Ctrl+Shift+V (a global shortcut), goes to xterm as usual.
 */
export function terminalKeyAction(e: KeyInfo, hasSelection: boolean): TerminalKeyAction {
	if (e.type !== 'keydown' || !e.ctrlKey || e.altKey) return 'xterm';
	const key = letter(e);
	if (key === 'c' && hasSelection) return 'copy';
	if (key === 'v' && !e.shiftKey) return 'native-paste';
	return 'xterm';
}

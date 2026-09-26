import { parseShortcut } from '../shortcuts';
import type { MonacoApi } from './setup';

/** "Ctrl+Shift+Enter" → Monaco's numeric keybinding, or null if a key isn't mapped. */
export function toMonacoKeybinding(monaco: MonacoApi, shortcut: string): number | null {
	const s = parseShortcut(shortcut);
	const { KeyCode, KeyMod } = monaco;
	const named: Record<string, number> = {
		enter: KeyCode.Enter,
		escape: KeyCode.Escape,
		esc: KeyCode.Escape,
		tab: KeyCode.Tab,
		space: KeyCode.Space,
		backspace: KeyCode.Backspace,
		delete: KeyCode.Delete,
		up: KeyCode.UpArrow,
		down: KeyCode.DownArrow,
		left: KeyCode.LeftArrow,
		right: KeyCode.RightArrow,
		'`': KeyCode.Backquote,
		'\\': KeyCode.Backslash,
		'/': KeyCode.Slash,
		'.': KeyCode.Period,
		',': KeyCode.Comma,
		';': KeyCode.Semicolon,
		'[': KeyCode.BracketLeft,
		']': KeyCode.BracketRight,
		'=': KeyCode.Equal,
		'-': KeyCode.Minus,
	};
	let code: number | undefined = named[s.key];
	if (code === undefined && /^[a-z]$/.test(s.key)) {
		code = KeyCode[`Key${s.key.toUpperCase()}` as keyof typeof KeyCode] as number;
	} else if (code === undefined && /^[0-9]$/.test(s.key)) {
		code = KeyCode[`Digit${s.key}` as keyof typeof KeyCode] as number;
	} else if (code === undefined && /^f\d{1,2}$/.test(s.key)) {
		code = KeyCode[s.key.toUpperCase() as keyof typeof KeyCode] as number;
	}
	if (code === undefined) return null;
	return (
		(s.ctrl ? KeyMod.CtrlCmd : 0) |
		(s.shift ? KeyMod.Shift : 0) |
		(s.alt ? KeyMod.Alt : 0) |
		code
	);
}

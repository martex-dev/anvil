import { useEffect } from 'react';

import { isAltGraph, isBindable, type KeyLike, shortcutMatchRank } from '../../lib/shortcuts';
import { useOverlayStore } from '../../stores/overlay-store';
import { getCommands, isContextActive, runCommand } from './run';
import type { Command } from './types';

/**
 * App commands that still fire while the terminal has focus; every other key goes to the shell.
 * Readline needs Ctrl+B/F/P/N/O/G/S/W/L/J, Ctrl+\ is SIGQUIT, Ctrl+Shift+V pastes, and TUI programs
 * use F5 and F9. Modelled on VS Code's `terminal.integrated.commandsToSkipShell` defaults: the
 * palette, Quick Open, the terminal toggle, view switches and window-level keys. Toggle Panel
 * (Ctrl+J) stays with the shell, where TUIs like Claude Code use it for a newline; Ctrl+` hides
 * the panel from inside the terminal instead.
 */
export const TERMINAL_SHORTCUTS: ReadonlySet<string> = new Set([
	'view.palette',
	'view.paletteF1',
	'file.quickOpen',
	'view.toggleTerminal',
	'view.problems',
	'view.fullscreen',
	'view.focusGroup1',
	'view.focusGroup2',
	'go.nextTab',
	'go.prevTab',
	'terminal.new',
	'anvil.settings',
	'anvil.shortcuts',
	// Ctrl+Shift+E/F/G/D/J/X: shells don't use Shift with Ctrl letters.
	'view.explorer',
	'view.search',
	'view.git',
	'view.run',
	'view.snippets',
	'view.toolbox',
]);

/**
 * Commands whose keys a plain text field needs: Ctrl+Shift+V pastes without formatting in any
 * input, and Ctrl+L in the chat box would re-attach the selection and yank the caret.
 */
const TEXT_FIELD_KEEPS: ReadonlySet<string> = new Set(['markdown.preview']);
const CHAT_INPUT_KEEPS: ReadonlySet<string> = new Set(['ai.focusChat']);

export interface ShortcutContext {
	/** Focus is inside xterm.js. */
	inTerminal?: boolean;
	/** Focus is in a text input or textarea other than Monaco's or xterm's. */
	inTextField?: boolean;
	/** Focus is in the AI chat's message box. */
	inChatInput?: boolean;
}

/** Whether a matched command may take the key where focus is. */
function allowedIn(command: Command, ctx: ShortcutContext): boolean {
	// Debug keys (F5, F10, F11…) must work while the program runs in the terminal, as in VS Code.
	if (ctx.inTerminal) return TERMINAL_SHORTCUTS.has(command.id) || command.when !== undefined;
	if (ctx.inChatInput && CHAT_INPUT_KEEPS.has(command.id)) return false;
	if ((ctx.inTextField || ctx.inChatInput) && TEXT_FIELD_KEEPS.has(command.id)) return false;
	return true;
}

/**
 * The global command bound to this key, if any. The best match wins, so a layout where the
 * printed and physical keys disagree (German's - sits on the US / key) runs one command, not two.
 * A command whose context (`when`, e.g. debugging) holds wins over the key's usual owner; one
 * whose context doesn't is skipped.
 */
export function globalCommandFor(
	event: KeyLike,
	commands: readonly Command[],
	ctx: ShortcutContext = {},
	active: (context: NonNullable<Command['when']>) => boolean = isContextActive,
): Command | null {
	if (isAltGraph(event)) return null;
	let best: Command | null = null;
	let bestScore = 0;
	for (const c of commands) {
		if ((c.scope ?? 'global') !== 'global' || !c.shortcut || !isBindable(c.shortcut)) continue;
		if (c.when && !active(c.when)) continue;
		const rank = shortcutMatchRank(event, c.shortcut);
		if (rank === 0) continue;
		// Same match quality: the command whose context holds takes the key.
		const score = rank * 2 + (c.when ? 1 : 0);
		if (score > bestScore) {
			best = c;
			bestScore = score;
		}
	}
	return best && allowedIn(best, ctx) ? best : null;
}

/** Where focus is, for `globalCommandFor`. */
export function shortcutContext(target: EventTarget | null): ShortcutContext {
	if (!(target instanceof Element)) return {};
	// xterm.js puts the `xterm` class on the terminal's root element.
	if (target.closest('.xterm')) return { inTerminal: true };
	if (target.closest('[data-part="chat-input"]')) return { inChatInput: true };
	// Monaco's hidden textarea is the editor, not a text field.
	const field = target.closest('input, textarea') !== null && !target.closest('.monaco-editor');
	return { inTextField: field };
}

/**
 * What a matched global shortcut does: `run` it, `swallow` the key (a held-down toggle must not
 * flicker or close tab after tab), or `pass` it on untouched to the open dialog or picker, so
 * Ctrl+W doesn't close the tab behind Settings and Ctrl+P doesn't stack a second modal.
 */
export function shortcutAction(
	event: Pick<KeyboardEvent, 'repeat' | 'isComposing'>,
	command: Pick<Command, 'allowInOverlay' | 'repeatable'>,
	overlayOpen: boolean,
): 'run' | 'swallow' | 'pass' {
	if (event.isComposing) return 'pass';
	if (overlayOpen && !command.allowInOverlay) return 'pass';
	if (event.repeat && !command.repeatable) return 'swallow';
	return 'run';
}

/**
 * Binds every global command's shortcut. Capture phase, so the editor can't swallow app-level
 * keys like Ctrl+P; the terminal and text fields keep the keys they need (see `allowedIn`).
 * Editor-scoped commands are bound inside Monaco instead.
 */
export function useGlobalShortcuts(): void {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent): void => {
			const fn = /^F\d{1,2}$/.test(event.key);
			if (!event.ctrlKey && !event.metaKey && !event.altKey && !fn) return;
			const command = globalCommandFor(event, getCommands(), shortcutContext(event.target));
			if (!command) return;
			const overlayOpen = useOverlayStore.getState().open.size > 0;
			const action = shortcutAction(event, command, overlayOpen);
			if (action === 'pass') return;
			event.preventDefault();
			event.stopPropagation();
			if (action === 'run') void runCommand(command);
		};
		window.addEventListener('keydown', onKeyDown, { capture: true });
		return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
	}, []);
}

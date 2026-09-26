import { useEffect } from 'react';

import { isBindable, matchesShortcut } from '../../lib/shortcuts';
import { getCommands, runCommand } from './run';
import type { Command } from './types';

type KeyEventLike = Parameters<typeof matchesShortcut>[0];

/** The global command bound to this key, if any, given whether the terminal has focus. */
export function globalCommandFor(
	event: KeyEventLike,
	commands: readonly Command[],
	inTerminal: boolean,
): Command | null {
	return (
		commands.find(
			(c) =>
				(c.scope ?? 'global') === 'global' &&
				!(inTerminal && c.terminalKeepsKey) &&
				c.shortcut &&
				isBindable(c.shortcut) &&
				matchesShortcut(event, c.shortcut),
		) ?? null
	);
}

/**
 * Binds every global command's shortcut. Capture phase, so the editor and terminal can't
 * swallow app-level keys like Ctrl+P. Editor-scoped commands are bound inside Monaco instead.
 */
export function useGlobalShortcuts(): void {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent): void => {
			const fn = /^F\d{1,2}$/.test(event.key);
			if (!event.ctrlKey && !event.metaKey && !event.altKey && !fn) return;
			// xterm.js puts the `xterm` class on the terminal's root element.
			const inTerminal =
				event.target instanceof Element && event.target.closest('.xterm') !== null;
			const command = globalCommandFor(event, getCommands(), inTerminal);
			if (!command) return;
			event.preventDefault();
			event.stopPropagation();
			void runCommand(command);
		};
		window.addEventListener('keydown', onKeyDown, { capture: true });
		return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
	}, []);
}

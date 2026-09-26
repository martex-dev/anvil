import { useEffect } from 'react';

import { isAltGraph, isBindable, matchesShortcut } from '../../lib/shortcuts';
import { useOverlayStore } from '../../stores/overlay-store';
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
 * Binds every global command's shortcut. Capture phase, so the editor and terminal can't
 * swallow app-level keys like Ctrl+P. Editor-scoped commands are bound inside Monaco instead.
 */
export function useGlobalShortcuts(): void {
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent): void => {
			const fn = /^F\d{1,2}$/.test(event.key);
			if (!event.ctrlKey && !event.metaKey && !event.altKey && !fn) return;
			// AltGr+S types ś on Polish layouts; let it through as text instead of Save All.
			if (isAltGraph(event)) return;
			// xterm.js puts the `xterm` class on the terminal's root element.
			const inTerminal =
				event.target instanceof Element && event.target.closest('.xterm') !== null;
			const command = globalCommandFor(event, getCommands(), inTerminal);
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

import { useEffect } from 'react';

import { isAltGraph, isBindable, matchesShortcut } from '../../lib/shortcuts';
import { getCommands, runCommand } from './run';

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
			const command = getCommands().find(
				(c) =>
					(c.scope ?? 'global') === 'global' &&
					c.shortcut &&
					isBindable(c.shortcut) &&
					matchesShortcut(event, c.shortcut),
			);
			if (!command) return;
			event.preventDefault();
			event.stopPropagation();
			void runCommand(command);
		};
		window.addEventListener('keydown', onKeyDown, { capture: true });
		return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
	}, []);
}

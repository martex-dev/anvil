import { useRef } from 'react';

import { focusedEditor } from '../../lib/monaco/editors';
import { runCommand } from '../commands/run';
import type { Command } from '../commands/types';

export interface MenuCommand {
	/** Call from a menu item's onSelect: remembers the command instead of running it. */
	pick: (command: Command) => void;
	/** Pass to the menu content's onCloseAutoFocus: runs the picked command once it has closed. */
	onCloseAutoFocus: (event: Event) => void;
}

/**
 * Runs a menu's chosen command after the menu has closed. Run from onSelect, Radix would then put
 * focus back on the menu button, stealing it from Find, Go to Line and the like; instead focus
 * goes back to the editor and the command may move it wherever it wants.
 */
export function useMenuCommand(): MenuCommand {
	const picked = useRef<Command | null>(null);
	return {
		pick: (command) => {
			picked.current = command;
		},
		onCloseAutoFocus: (event) => {
			const command = picked.current;
			if (!command) return;
			picked.current = null;
			event.preventDefault();
			focusedEditor()?.focus();
			void runCommand(command);
		},
	};
}

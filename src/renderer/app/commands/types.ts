import type { LucideIcon } from 'lucide-react';

export type CommandCategory =
	| 'File'
	| 'Edit'
	| 'View'
	| 'Go'
	| 'Run'
	| 'Python'
	| 'AI'
	| 'Git'
	| 'Terminal'
	| 'Tools'
	| 'Anvil';

export interface Command {
	/** Globally unique, e.g. `python.runFile`. */
	id: string;
	title: string;
	category: CommandCategory;
	/** Display + binding, e.g. `Ctrl+Shift+P`, `F5`. */
	shortcut?: string;
	/**
	 * 'global' shortcuts work everywhere (captured before any widget sees the key).
	 * 'editor' shortcuts are Monaco actions: they fire only while a code editor has focus, so
	 * keys like Shift+Enter keep working normally in inputs and terminals.
	 */
	scope?: 'global' | 'editor';
	/**
	 * Global shortcuts only: leave the key to the integrated terminal while it has focus, for
	 * keys shells rely on (Ctrl+L clears the screen).
	 */
	terminalKeepsKey?: boolean;
	/** Editor-scoped commands only fire for this Monaco language (e.g. Shift+Enter in Python). */
	editorLanguage?: string;
	keywords?: string[];
	icon?: LucideIcon;
	run(): void | Promise<void>;
}

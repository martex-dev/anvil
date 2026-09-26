import type { CommandCategory } from '../../app/commands/types';

/**
 * The classic menu bar. `key` is the underlined mnemonic: Alt+key opens the menu, like every
 * program of the era (Git takes its 'i' because Go already owns 'G').
 */
export interface MenuDef {
	label: string;
	key: string;
	categories: CommandCategory[];
}

export const MENUS: readonly MenuDef[] = [
	{ label: 'File', key: 'f', categories: ['File'] },
	{ label: 'Edit', key: 'e', categories: ['Edit'] },
	{ label: 'View', key: 'v', categories: ['View'] },
	{ label: 'Go', key: 'g', categories: ['Go'] },
	{ label: 'Run', key: 'r', categories: ['Run', 'Python', 'Terminal'] },
	{ label: 'AI', key: 'a', categories: ['AI'] },
	{ label: 'Git', key: 'i', categories: ['Git'] },
	{ label: 'Tools', key: 't', categories: ['Tools', 'Anvil'] },
];

/** The menu Alt+<key> opens, if any. */
export function menuForKey(key: string): MenuDef | undefined {
	const k = key.toLowerCase();
	return MENUS.find((m) => m.key === k);
}

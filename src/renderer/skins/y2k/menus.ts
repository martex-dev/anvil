import type { CommandCategory } from '../../app/commands/types';

/** The title bar's menus: each gathers the commands of a few palette categories. */
export const MENUS: ReadonlyArray<{ label: string; categories: CommandCategory[] }> = [
	{ label: 'File', categories: ['File'] },
	{ label: 'Edit', categories: ['Edit'] },
	{ label: 'View', categories: ['View'] },
	{ label: 'Go', categories: ['Go'] },
	{ label: 'Run', categories: ['Run', 'Python', 'Terminal'] },
	{ label: 'AI', categories: ['AI'] },
	{ label: 'Git', categories: ['Git'] },
	{ label: 'Tools', categories: ['Tools', 'Anvil'] },
];

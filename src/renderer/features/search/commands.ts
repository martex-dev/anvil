import { Replace } from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { replaceInFiles } from './use-search';

export const SEARCH_COMMANDS: Command[] = [
	{
		id: 'search.replaceInFiles',
		title: 'Replace in Files',
		category: 'Edit',
		// VS Code's binding. Ctrl+H stays Monaco's replace in the current file.
		shortcut: 'Ctrl+Shift+H',
		keywords: ['find and replace', 'search'],
		icon: Replace,
		run: replaceInFiles,
	},
];

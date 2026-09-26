import { Bot, Sparkles, SquareTerminal, TerminalSquare, Wand2, X } from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { closeTerminal, newTerminal, useTerminalStore } from './terminal-store';

export const TERMINAL_COMMANDS: Command[] = [
	{
		id: 'terminal.new',
		title: 'New Terminal',
		category: 'Terminal',
		shortcut: 'Ctrl+Shift+`',
		keywords: ['shell', 'powershell'],
		icon: TerminalSquare,
		run: () => newTerminal('powershell'),
	},
	{
		id: 'terminal.newPython',
		title: 'New Python Env Shell',
		category: 'Terminal',
		keywords: ['venv', 'activate'],
		icon: SquareTerminal,
		run: () => newTerminal('python'),
	},
	{
		id: 'terminal.newCmd',
		title: 'New Command Prompt',
		category: 'Terminal',
		run: () => newTerminal('cmd'),
	},
	{
		id: 'terminal.newBash',
		title: 'New Git Bash',
		category: 'Terminal',
		run: () => newTerminal('gitbash'),
	},
	{
		id: 'terminal.claude',
		title: 'Open Claude Code',
		category: 'Terminal',
		keywords: ['ai', 'agent', 'cli'],
		icon: Sparkles,
		run: () => newTerminal('claude', 'claude'),
	},
	{
		id: 'terminal.codex',
		title: 'Open Codex CLI',
		category: 'Terminal',
		keywords: ['ai', 'agent', 'openai'],
		icon: Bot,
		run: () => newTerminal('codex', 'codex'),
	},
	{
		id: 'terminal.gemini',
		title: 'Open Gemini CLI',
		category: 'Terminal',
		keywords: ['ai', 'agent', 'google'],
		icon: Wand2,
		run: () => newTerminal('gemini', 'gemini'),
	},
	{
		id: 'terminal.kill',
		title: 'Kill Active Terminal',
		category: 'Terminal',
		icon: X,
		run: () => {
			const id = useTerminalStore.getState().active;
			if (id) closeTerminal(id);
		},
	},
];

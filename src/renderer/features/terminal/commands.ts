import { Bot, Sparkles, SquareTerminal, TerminalSquare, Wand2, X } from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { useLayoutStore } from '../../stores/layout-store';
import { toast } from '../../stores/toast-store';
import { quickPick } from '../../ui/QuickPick';
import { closeTerminal, newTerminal, useTerminalStore } from './terminal-store';

/** Command Prompt and Git Bash are Windows shells; main doesn't offer them elsewhere. */
function newWindowsTerminal(preset: 'cmd' | 'gitbash', label: string): void {
	if (window.anvil.platform !== 'win32') {
		toast.info(`${label} is only available on Windows`);
		return;
	}
	newTerminal(preset);
}

/** Kills the active terminal, asking first when it isn't on screen (a hidden training run). */
export async function killActiveTerminal(): Promise<void> {
	const { tabs, active } = useTerminalStore.getState();
	const tab = tabs.find((t) => t.id === active);
	if (!tab) {
		toast.info('No terminal to kill');
		return;
	}
	const layout = useLayoutStore.getState();
	if (!layout.panelOpen || layout.panelTab !== 'terminal') {
		const answer = await quickPick({
			title: `Kill ${tab.title}?`,
			placeholder: 'This terminal is hidden: anything running in it will stop',
			items: [
				{ id: 'kill', label: `Kill ${tab.title}` },
				{ id: 'cancel', label: 'Cancel' },
			],
		});
		if (answer !== 'kill') return;
	}
	closeTerminal(tab.id);
	toast.info(`Killed ${tab.title}`);
}

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
		run: () => newWindowsTerminal('cmd', 'Command Prompt'),
	},
	{
		id: 'terminal.newBash',
		title: 'New Git Bash',
		category: 'Terminal',
		run: () => newWindowsTerminal('gitbash', 'Git Bash'),
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
		run: killActiveTerminal,
	},
];

import {
	ArrowLeftRight,
	Bot,
	Pencil,
	Sparkles,
	SquareTerminal,
	TerminalSquare,
	Wand2,
	X,
} from 'lucide-react';

import type { Command } from '../../app/commands/types';
import { useLayoutStore } from '../../stores/layout-store';
import { toast } from '../../stores/toast-store';
import { quickPick } from '../../ui/QuickPick';
import { closeTerminal, focusTerminal, newTerminal, useTerminalStore } from './terminal-store';

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

async function renameActiveTerminal(): Promise<void> {
	const { tabs, active } = useTerminalStore.getState();
	const tab = tabs.find((t) => t.id === active);
	if (!tab) {
		toast.info('No terminal to rename');
		return;
	}
	const picked = await quickPick({
		title: 'rename terminal',
		placeholder: `New name for ${tab.title}`,
		items: [],
		allowCustom: { label: (text) => `Rename to "${text}"` },
	});
	const name = picked?.startsWith('custom:') ? picked.slice(7).trim() : '';
	if (name) useTerminalStore.getState().rename(tab.id, name.slice(0, 200));
}

async function switchTerminal(): Promise<void> {
	const { tabs, active } = useTerminalStore.getState();
	if (tabs.length === 0) {
		toast.info('No terminals open');
		return;
	}
	const picked = await quickPick({
		title: 'switch terminal',
		placeholder: 'Terminal to show',
		items: tabs.map((t) => ({ id: t.id, label: t.title, current: t.id === active })),
	});
	if (picked && tabs.some((t) => t.id === picked)) focusTerminal(picked);
}

/** Shows the next (+1) or previous (-1) terminal tab, wrapping around. */
export function cycleTerminal(step: 1 | -1): void {
	const { tabs, active } = useTerminalStore.getState();
	if (tabs.length === 0) {
		toast.info('No terminals open');
		return;
	}
	const index = tabs.findIndex((t) => t.id === active);
	const next = tabs[(index + step + tabs.length) % tabs.length];
	if (next) focusTerminal(next.id);
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
	{
		id: 'terminal.rename',
		title: 'Rename Terminal…',
		category: 'Terminal',
		icon: Pencil,
		run: renameActiveTerminal,
	},
	{
		id: 'terminal.switch',
		title: 'Switch Terminal…',
		category: 'Terminal',
		keywords: ['select', 'focus', 'tab'],
		icon: ArrowLeftRight,
		run: switchTerminal,
	},
	{
		id: 'terminal.next',
		title: 'Next Terminal',
		category: 'Terminal',
		run: () => cycleTerminal(1),
	},
	{
		id: 'terminal.prev',
		title: 'Previous Terminal',
		category: 'Terminal',
		run: () => cycleTerminal(-1),
	},
];

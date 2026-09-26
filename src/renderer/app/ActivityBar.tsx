import {
	Blocks,
	Bot,
	Files,
	GitBranch,
	History,
	ListTodo,
	ListTree,
	type LucideIcon,
	Play,
	Search,
	Settings,
	Wrench,
} from 'lucide-react';
import type { JSX } from 'react';

import { useGitStatus } from '../features/git/use-git';
import { cn } from '../lib/cn';
import { type SideView, useLayoutStore } from '../stores/layout-store';
import { Tooltip } from '../ui/Tooltip';
import { runCommandById, shortcutFor } from './commands/run';

export const VIEW_META: Record<SideView, { label: string; icon: LucideIcon; command: string }> = {
	explorer: { label: 'Explorer', icon: Files, command: 'view.explorer' },
	search: { label: 'Search', icon: Search, command: 'view.search' },
	git: { label: 'Source Control', icon: GitBranch, command: 'view.git' },
	run: { label: 'Run & Python', icon: Play, command: 'view.run' },
	outline: { label: 'Outline & Bookmarks', icon: ListTree, command: 'view.outline' },
	todos: { label: 'TODOs', icon: ListTodo, command: 'view.todos' },
	history: { label: 'Local History', icon: History, command: 'view.history' },
	snippets: { label: 'Snippets', icon: Blocks, command: 'view.snippets' },
	toolbox: { label: 'Toolbox', icon: Wrench, command: 'view.toolbox' },
};

const ORDER: SideView[] = [
	'explorer',
	'search',
	'git',
	'run',
	'outline',
	'todos',
	'history',
	'snippets',
	'toolbox',
];

function Item({ view, badge }: { view: SideView; badge?: number }): JSX.Element {
	const active = useLayoutStore((s) => s.sideOpen && s.sideView === view);
	const meta = VIEW_META[view];
	const Icon = meta.icon;
	return (
		<Tooltip content={meta.label} shortcut={shortcutFor(meta.command)} side='right'>
			<button
				type='button'
				aria-label={
					badge !== undefined && badge > 0
						? `${meta.label}, ${badge} changes`
						: meta.label
				}
				aria-pressed={active}
				onClick={() => useLayoutStore.getState().toggleView(view)}
				className={cn(
					'relative flex size-10 items-center justify-center rounded-lg outline-none transition-[color,background-color] transition-fast',
					active
						? 'bg-accent-faint text-accent'
						: 'text-fg-2 hover:bg-bg-3/50 hover:text-fg-0',
					'focus-visible:shadow-glow',
				)}
			>
				{active && (
					<span className='accent-line absolute top-2 bottom-2 -left-[5px] w-[2px] rounded-full' />
				)}
				<Icon
					size={18}
					strokeWidth={1.75}
					className={active ? 'drop-shadow-[0_0_6px_var(--accent)]' : ''}
				/>
				{badge !== undefined && badge > 0 && (
					<span className='num absolute top-1 right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[9px] font-bold text-on-accent'>
						{badge > 99 ? '99+' : badge}
					</span>
				)}
			</button>
		</Tooltip>
	);
}

export function ActivityBar(): JSX.Element {
	const { status } = useGitStatus();
	const changes = status?.isRepo ? status.staged.length + status.unstaged.length : 0;
	const aiOpen = useLayoutStore((s) => s.aiOpen);
	return (
		<nav
			aria-label='Views'
			className='glass flex w-12 shrink-0 flex-col items-center gap-1 py-2'
		>
			{ORDER.map((view) => (
				<Item key={view} view={view} {...(view === 'git' ? { badge: changes } : {})} />
			))}
			<span className='flex-1' />
			<Tooltip content='AI assistant' shortcut={shortcutFor('view.toggleAi')} side='right'>
				<button
					type='button'
					aria-label='AI assistant'
					aria-pressed={aiOpen}
					onClick={() => useLayoutStore.getState().toggleAi()}
					className={cn(
						'relative flex size-10 items-center justify-center rounded-lg outline-none transition-colors transition-fast focus-visible:shadow-glow',
						aiOpen
							? 'bg-accent-faint text-accent-2'
							: 'text-fg-2 hover:bg-bg-3/50 hover:text-fg-0',
					)}
				>
					{aiOpen && (
						<span className='accent-line absolute top-2 bottom-2 -left-[5px] w-[2px] rounded-full' />
					)}
					<Bot size={18} strokeWidth={1.75} />
				</button>
			</Tooltip>
			<Tooltip content='Settings' shortcut={shortcutFor('anvil.settings')} side='right'>
				<button
					type='button'
					aria-label='Settings'
					onClick={() => runCommandById('anvil.settings')}
					className='flex size-10 items-center justify-center rounded-lg text-fg-2 outline-none transition-colors transition-fast hover:bg-bg-3/50 hover:text-fg-0 focus-visible:shadow-glow'
				>
					<Settings size={18} strokeWidth={1.75} />
				</button>
			</Tooltip>
		</nav>
	);
}

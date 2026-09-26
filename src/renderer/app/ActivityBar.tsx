import {
	Blocks,
	Files,
	GitBranch,
	History,
	ListTodo,
	ListTree,
	type LucideIcon,
	Play,
	Search,
	Wrench,
} from 'lucide-react';
import type { JSX } from 'react';

import { useGitStatus } from '../features/git/use-git';
import { cn } from '../lib/cn';
import { useLook } from '../skins/look-store';
import { SkinIcon } from '../skins/SkinIcon';
import { SIDE_VIEWS, type SideView, useLayoutStore } from '../stores/layout-store';
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

/** Short names for labelled activity strips ('F1 FILES'). */
export const VIEW_SHORT: Record<SideView, string> = {
	explorer: 'Files',
	search: 'Search',
	git: 'Git',
	run: 'Run',
	outline: 'Outline',
	todos: 'Todos',
	history: 'History',
	snippets: 'Snippets',
	toolbox: 'Tools',
};

interface ItemProps {
	label: string;
	short: string;
	command: string;
	icon: SideView | 'ai' | 'settings';
	active: boolean;
	onClick: () => void;
	vertical: boolean;
	labels: boolean;
	index?: number;
	badge?: number;
}

function Item({
	label,
	short,
	command,
	icon,
	active,
	onClick,
	vertical,
	labels,
	index,
	badge,
}: ItemProps): JSX.Element {
	return (
		<Tooltip
			content={label}
			shortcut={shortcutFor(command)}
			side={vertical ? 'right' : 'bottom'}
		>
			<button
				type='button'
				aria-label={label}
				aria-pressed={active}
				data-part='activity-item'
				data-view={icon}
				data-index={index}
				data-active={active}
				onClick={onClick}
				className={cn(
					'relative flex shrink-0 items-center justify-center gap-1.5 rounded-lg outline-none transition-[color,background-color] transition-fast focus-visible:shadow-glow',
					vertical ? 'size-10' : 'h-full px-2.5',
					active
						? 'bg-accent-faint text-accent'
						: 'text-fg-2 hover:bg-bg-3/50 hover:text-fg-0',
				)}
			>
				{active && vertical && (
					<span
						data-part='activity-marker'
						className='accent-line absolute top-2 bottom-2 -left-[5px] w-[2px] rounded-full'
					/>
				)}
				<SkinIcon
					name={icon}
					size={vertical ? 18 : 14}
					className={active ? 'drop-shadow-[0_0_6px_var(--accent)]' : ''}
				/>
				{labels && (
					<span data-part='activity-label' className='text-12 whitespace-nowrap'>
						{short}
					</span>
				)}
				{badge !== undefined && badge > 0 && (
					<span
						data-part='activity-badge'
						className='num absolute top-1 right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[9px] font-bold text-on-accent'
					>
						{badge > 99 ? '99+' : badge}
					</span>
				)}
			</button>
		</Tooltip>
	);
}

/**
 * The views switcher. The skin decides the shape: a vertical bar (left or right), a labelled
 * strip above the workbench, or a rail that slides in on hover. Items carry `data-index` so a
 * skin can print F-key hints in CSS.
 */
export function ActivityBar(): JSX.Element {
	const { layout } = useLook();
	const { status } = useGitStatus();
	const changes = status?.isRepo ? status.staged.length + status.unstaged.length : 0;
	const aiOpen = useLayoutStore((s) => s.aiOpen);
	const current = useLayoutStore((s) => (s.sideOpen ? s.sideView : null));
	const vertical = layout.activity !== 'top';
	const labels = layout.activityLabels;
	const common = { vertical, labels };
	return (
		<nav
			aria-label='Views'
			data-part='activity'
			data-orientation={vertical ? 'vertical' : 'horizontal'}
			data-placement={layout.activity}
			className={cn(
				'glass flex shrink-0 items-center gap-1',
				vertical ? 'w-12 flex-col py-2' : 'h-9 flex-row overflow-x-auto px-1.5',
			)}
		>
			{SIDE_VIEWS.map((view, i) => (
				<Item
					key={view}
					label={VIEW_META[view].label}
					short={VIEW_SHORT[view]}
					command={VIEW_META[view].command}
					icon={view}
					index={i + 1}
					active={current === view}
					onClick={() => useLayoutStore.getState().toggleView(view)}
					{...(view === 'git' ? { badge: changes } : {})}
					{...common}
				/>
			))}
			<span data-part='activity-spacer' className='flex-1' />
			<Item
				label='AI assistant'
				short='AI'
				command='view.toggleAi'
				icon='ai'
				active={aiOpen}
				onClick={() => useLayoutStore.getState().toggleAi()}
				{...common}
			/>
			<Item
				label='Settings'
				short='Setup'
				command='anvil.settings'
				icon='settings'
				active={false}
				onClick={() => runCommandById('anvil.settings')}
				{...common}
			/>
		</nav>
	);
}

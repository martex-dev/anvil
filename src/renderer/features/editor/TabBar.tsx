import { Columns2, Eye, Play, X } from 'lucide-react';
import { type JSX, useState } from 'react';

import { runCommandById, shortcutFor } from '../../app/commands/run';
import { useSettings } from '../../app/hooks/use-settings';
import { cn } from '../../lib/cn';
import { type Group, type Tab, useTabsStore } from '../../stores/tabs-store';
import { AppContextMenu } from '../../ui/ContextMenu';
import { badgeFor, FileBadge } from '../../ui/FileBadge';
import { IconButton } from '../../ui/IconButton';
import { useProblems } from '../problems/problems-store';
import { useEditorStore } from './editor-store';
import { isScratch } from './file-ops';
import { closeOtherTabs, closeTab } from './open';

function TabView({
	tab,
	group,
	active,
	focused,
}: {
	tab: Tab;
	group: number;
	active: boolean;
	focused: boolean;
}): JSX.Element {
	const file = useEditorStore((s) =>
		tab.path ? s.files.find((f) => f.path === tab.path) : undefined,
	);
	const dirty = tab.kind === 'code' && Boolean(file?.dirty);
	const changed = Boolean(file?.changedOnDisk);
	const { activate, pin, split } = useTabsStore.getState();
	const [dragOver, setDragOver] = useState(false);
	const label = tab.kind === 'welcome' ? 'Welcome' : tab.title;
	const fileName = isScratch(tab.path)
		? 'scratch.py'
		: (tab.path?.split('/').at(-1) ?? tab.title);
	const tintOn = useSettings().settings.tabTint;
	// Tinted by file type (the badge color), so a wall of tabs is scannable at a glance.
	const tint = tintOn && tab.kind === 'code' ? badgeFor(fileName).color : null;
	const hasError = useProblems((st) =>
		tab.path ? st.items.some((p) => p.path === tab.path && p.severity === 'error') : false,
	);

	return (
		<AppContextMenu
			items={[
				{ label: 'Close', shortcut: 'Ctrl+W', onSelect: () => closeTab(group, tab.id) },
				{ label: 'Close Others', onSelect: () => closeOtherTabs(group, tab.id) },
				'separator',
				{ label: 'Split Right', shortcut: 'Ctrl+\\', onSelect: () => split(tab.id) },
				...(tab.path
					? [
							{
								label: 'Copy Path',
								onSelect: () => void navigator.clipboard.writeText(tab.path ?? ''),
							},
							{
								label: 'Reveal in Explorer',
								onSelect: () => runCommandById('explorer.revealActive'),
							},
						]
					: []),
			]}
		>
			<div
				role='tab'
				aria-selected={active}
				data-part='tab'
				data-active={active}
				tabIndex={active ? 0 : -1}
				title={tab.path ?? label}
				draggable
				onDragStart={(e) =>
					e.dataTransfer.setData('text/anvil-tab', JSON.stringify({ id: tab.id, group }))
				}
				onDragOver={(e) => {
					if (e.dataTransfer.types.includes('text/anvil-tab')) {
						e.preventDefault();
						setDragOver(true);
					}
				}}
				onDragLeave={() => setDragOver(false)}
				onDrop={(e) => {
					setDragOver(false);
					const raw = e.dataTransfer.getData('text/anvil-tab');
					if (!raw) return;
					const from = JSON.parse(raw) as { id: string; group: number };
					const g = useTabsStore.getState().groups.find((x) => x.id === group);
					if (!g) return;
					if (from.group === group) {
						useTabsStore
							.getState()
							.move(group, g.tabIds.indexOf(from.id), g.tabIds.indexOf(tab.id));
					} else {
						const moved = useTabsStore.getState().tabs[from.id];
						if (moved) {
							useTabsStore.getState().open(moved, { group });
							useTabsStore.getState().close(from.group, from.id);
						}
					}
				}}
				onClick={() => activate(group, tab.id)}
				onDoubleClick={() => pin(tab.id)}
				onAuxClick={(e) => {
					if (e.button === 1) closeTab(group, tab.id);
				}}
				onKeyDown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') activate(group, tab.id);
				}}
				className={cn(
					'group relative flex h-full max-w-60 shrink-0 cursor-default items-center gap-2 pr-1 pl-3 text-12 outline-none',
					'transition-colors transition-fast',
					active
						? 'bg-accent-faint text-fg-0'
						: 'text-fg-2 hover:bg-bg-3/40 hover:text-fg-1',
					dragOver && 'shadow-[inset_2px_0_0_var(--accent)]',
					hasError && !active && 'text-down/80',
					'focus-visible:shadow-[inset_0_0_0_1px_var(--accent)]',
				)}
				style={
					tint && active
						? { backgroundColor: `color-mix(in oklab, var(${tint}) 9%, transparent)` }
						: undefined
				}
			>
				{active && (
					<span
						className={cn(
							'absolute inset-x-2 top-0 h-[2px] rounded-full',
							focused ? 'accent-line' : 'bg-border-strong',
						)}
						style={
							tint && focused
								? {
										backgroundImage: `linear-gradient(90deg, var(${tint}), var(--accent))`,
									}
								: undefined
						}
					/>
				)}
				{!active && tint && (
					<span
						className='absolute inset-x-3 bottom-0 h-px rounded-full opacity-50'
						style={{ backgroundColor: `var(${tint})` }}
					/>
				)}
				{tab.kind === 'markdown' ? (
					<Eye size={12} className='text-fg-2' />
				) : tab.kind === 'welcome' ? (
					<span className='size-2 rotate-45 bg-accent' />
				) : (
					<FileBadge name={fileName} />
				)}
				{hasError && (
					<span
						title='This file has errors'
						data-part='tab-error'
						className='size-1.5 shrink-0 rounded-full bg-down shadow-[0_0_6px_var(--down)]'
					/>
				)}
				<span
					data-part='tab-label'
					className={cn('truncate', tab.preview && 'italic', changed && 'text-warn')}
				>
					{label}
				</span>
				<button
					type='button'
					aria-label={dirty ? `Close ${label} (unsaved)` : `Close ${label}`}
					data-part='tab-close'
					data-dirty={dirty}
					onClick={(e) => {
						e.stopPropagation();
						closeTab(group, tab.id);
					}}
					className='flex size-5 items-center justify-center rounded-sm text-fg-2 hover:bg-bg-3 hover:text-fg-0'
				>
					{dirty ? (
						<>
							<span className='size-2 rounded-full bg-accent shadow-glow group-hover:hidden' />
							<X size={12} className='hidden group-hover:block' />
						</>
					) : (
						<X size={12} className={active ? '' : 'invisible group-hover:visible'} />
					)}
				</button>
				<span className='absolute top-2 right-0 bottom-2 w-px bg-glass-edge' />
			</div>
		</AppContextMenu>
	);
}

export function TabBar({ group, focused }: { group: Group; focused: boolean }): JSX.Element {
	const tabs = useTabsStore((s) => s.tabs);
	const activeTab = group.active ? tabs[group.active] : undefined;
	const isPython = activeTab?.kind === 'code' && activeTab.path?.endsWith('.py');
	const isMarkdown = activeTab?.kind === 'code' && /\.(md|markdown)$/i.test(activeTab.path ?? '');
	return (
		<div
			data-part='tabbar'
			className='flex h-9 shrink-0 items-stretch border-b border-glass-edge'
		>
			<div
				role='tablist'
				aria-label='Open editors'
				className='flex min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden [scrollbar-width:thin]'
				onWheel={(e) => {
					e.currentTarget.scrollLeft += e.deltaY;
				}}
			>
				{group.tabIds.map((id) => {
					const tab = tabs[id];
					return tab ? (
						<TabView
							key={id}
							tab={tab}
							group={group.id}
							active={id === group.active}
							focused={focused}
						/>
					) : null;
				})}
			</div>
			<div className='flex shrink-0 items-center gap-0.5 px-1.5'>
				{isPython && (
					<IconButton
						size='sm'
						label='Run Python file'
						shortcut={shortcutFor('python.runFile')}
						icon={<Play size={13} className='fill-current text-up' />}
						onClick={() => runCommandById('python.runFile')}
					/>
				)}
				{isMarkdown && (
					<IconButton
						size='sm'
						label='Open preview to the side'
						icon={<Eye size={13} />}
						onClick={() => runCommandById('markdown.preview')}
					/>
				)}
				<IconButton
					size='sm'
					label='Split editor right'
					shortcut={shortcutFor('view.splitEditor')}
					icon={<Columns2 size={13} />}
					onClick={() => runCommandById('view.splitEditor')}
				/>
			</div>
		</div>
	);
}

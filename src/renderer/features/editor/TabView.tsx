import { Eye, X } from 'lucide-react';
import { type JSX, useState } from 'react';

import { useSettings } from '../../app/hooks/use-settings';
import { cn } from '../../lib/cn';
import { type Tab, useTabsStore } from '../../stores/tabs-store';
import { AppContextMenu } from '../../ui/ContextMenu';
import { badgeFor, FileBadge } from '../../ui/FileBadge';
import { useProblems } from '../problems/problems-store';
import { useEditorStore } from './editor-store';
import { isScratch } from './file-ops';
import { closeTab } from './open';
import { type DropSide, dropSide, dropTab, TAB_MIME } from './tab-drop';
import { focusTab, tabKeyTarget } from './tab-keys';
import { tabMenuItems } from './tab-menu';

/** One editor tab: label, badges, close button, drag and drop and its context menu. */
export function TabView({
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
	const { activate, pin } = useTabsStore.getState();
	const [dropAt, setDropAt] = useState<DropSide | null>(null);
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
		<AppContextMenu items={tabMenuItems(tab, group)}>
			<div
				role='tab'
				data-tab-id={tab.id}
				aria-selected={active}
				tabIndex={active ? 0 : -1}
				title={tab.path ?? label}
				draggable
				onDragStart={(e) =>
					e.dataTransfer.setData(TAB_MIME, JSON.stringify({ id: tab.id, group }))
				}
				onDragOver={(e) => {
					if (!e.dataTransfer.types.includes(TAB_MIME)) return;
					e.preventDefault();
					setDropAt(dropSide(e.clientX, e.currentTarget.getBoundingClientRect()));
				}}
				onDragLeave={(e) => {
					// Moving onto the label or close button isn't leaving the tab.
					const to = e.relatedTarget;
					if (to instanceof Node && e.currentTarget.contains(to)) return;
					setDropAt(null);
				}}
				onDrop={(e) => {
					const side = dropSide(e.clientX, e.currentTarget.getBoundingClientRect());
					setDropAt(null);
					const raw = e.dataTransfer.getData(TAB_MIME);
					if (raw) dropTab(raw, group, tab.id, side);
				}}
				onClick={() => activate(group, tab.id)}
				onDoubleClick={() => pin(tab.id)}
				onAuxClick={(e) => {
					if (e.button === 1) closeTab(group, tab.id);
				}}
				onKeyDown={(e) => {
					// Keys on the nested close button are its own.
					if (e.target !== e.currentTarget) return;
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						activate(group, tab.id);
						return;
					}
					const ids = useTabsStore.getState().groups.find((g) => g.id === group)?.tabIds;
					if (e.key === 'Delete') {
						e.preventDefault();
						closeTab(group, tab.id);
						// Keep the keyboard in the strip, on the tab that took this one's place. A dirty
						// tab stays open behind the save dialog, which keeps focus.
						const after = useTabsStore.getState().groups.find((g) => g.id === group);
						const next = after?.tabIds.includes(tab.id) ? null : after?.active;
						if (next) setTimeout(() => focusTab(group, next), 0);
						return;
					}
					const target = ids ? tabKeyTarget(e.key, ids, tab.id) : null;
					if (target) {
						e.preventDefault();
						focusTab(group, target);
					}
				}}
				className={cn(
					'group relative flex h-full max-w-60 shrink-0 cursor-default items-center gap-2 pr-1 pl-3 text-12 outline-none',
					'transition-colors transition-fast',
					active
						? 'bg-accent-faint text-fg-0'
						: 'text-fg-2 hover:bg-bg-3/40 hover:text-fg-1',
					dropAt === 'before' && 'shadow-[inset_2px_0_0_var(--accent)]',
					dropAt === 'after' && 'shadow-[inset_-2px_0_0_var(--accent)]',
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
						className='size-1.5 shrink-0 rounded-full bg-down shadow-[0_0_6px_var(--down)]'
					/>
				)}
				<span className={cn('truncate', tab.preview && 'italic', changed && 'text-warn')}>
					{label}
				</span>
				<button
					type='button'
					aria-label={dirty ? `Close ${label} (unsaved)` : `Close ${label}`}
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

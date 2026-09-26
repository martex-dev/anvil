import { Columns2, Eye, Play } from 'lucide-react';
import type { JSX } from 'react';

import { runCommandById, shortcutFor } from '../../app/commands/run';
import { type Group, useTabsStore } from '../../stores/tabs-store';
import { IconButton } from '../../ui/IconButton';
import { TabView } from './TabView';

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
				data-group={group.id}
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
						shortcut={shortcutFor('markdown.preview')}
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

import { Bug, ChevronRight, Play } from 'lucide-react';
import type { JSX, KeyboardEvent } from 'react';

import type { TestNode, TestResult } from '@shared/ipc/channels/tests';

import { cn } from '../../lib/cn';
import { FileBadge } from '../../ui/FileBadge';
import { IconButton } from '../../ui/IconButton';
import { formatDuration } from './results';
import { STATUS_LABEL, TestStatusIcon } from './TestStatusIcon';
import type { NodeStatus, TreeRow } from './tree-utils';

interface TestRowProps {
	row: TreeRow;
	status: NodeStatus;
	result: TestResult | undefined;
	selected: boolean;
	tabStop: boolean;
	onSelect: (node: TestNode, open: boolean) => void;
	onToggle: (node: TestNode, open: boolean) => void;
	onRun: (node: TestNode) => void;
	onDebug: (node: TestNode) => void;
	onFocusRow: (id: string) => void;
}

/** One tree row: disclosure, status, name, duration, and run/debug buttons on hover or focus. */
export function TestRow({
	row,
	status,
	result,
	selected,
	tabStop,
	onSelect,
	onToggle,
	onRun,
	onDebug,
	onFocusRow,
}: TestRowProps): JSX.Element {
	const { node, depth, open } = row;
	const parent = node.children.length > 0;
	const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>): void => {
		if (e.key === 'ArrowRight' && parent && !open) {
			e.preventDefault();
			onToggle(node, true);
		} else if (e.key === 'ArrowLeft' && parent && open) {
			e.preventDefault();
			onToggle(node, false);
		} else if (e.key === 'Enter' && e.ctrlKey) {
			// Ctrl+Enter runs the focused row, like the play button.
			e.preventDefault();
			onRun(node);
		}
	};
	return (
		<li role='none' className='group relative' data-part='test-row' data-kind={node.kind}>
			<button
				type='button'
				role='treeitem'
				aria-level={depth + 1}
				aria-selected={selected}
				aria-expanded={parent ? open : undefined}
				aria-label={`${node.label}, ${STATUS_LABEL[status]}`}
				data-roving
				data-test-id={node.id}
				data-status={status}
				tabIndex={tabStop ? 0 : -1}
				onFocus={() => onFocusRow(node.id)}
				onClick={() => onSelect(node, true)}
				onDoubleClick={() => parent && onToggle(node, !open)}
				onKeyDown={onKeyDown}
				style={{ paddingLeft: 6 + depth * 12 }}
				className={cn(
					'flex h-6 w-full items-center gap-1.5 pr-14 text-left text-12 outline-none focus-visible:shadow-glow',
					selected
						? 'bg-accent-faint text-fg-0'
						: 'text-fg-1 hover:bg-bg-3/40 focus-visible:bg-accent-faint',
				)}
			>
				<span
					aria-hidden
					onClick={(e) => {
						if (!parent) return;
						e.stopPropagation();
						onToggle(node, !open);
					}}
					className='flex size-3.5 shrink-0 items-center justify-center text-fg-2'
				>
					{parent && (
						<ChevronRight
							size={12}
							className={cn(
								'transition-transform transition-fast',
								open && 'rotate-90',
							)}
						/>
					)}
				</span>
				<TestStatusIcon status={status} />
				{node.kind === 'file' && (
					<FileBadge name={node.label.split('/').at(-1) ?? node.label} />
				)}
				<span
					className={cn(
						'truncate',
						node.kind === 'file' && 'font-medium',
						node.kind === 'case' && 'font-mono text-11',
					)}
					title={node.id}
				>
					{node.label}
				</span>
				{result && (
					<span className='num ml-auto shrink-0 text-10 text-fg-2'>
						{formatDuration(result.duration)}
					</span>
				)}
			</button>
			<span
				data-part='test-row-actions'
				className='absolute top-0 right-1 flex h-6 items-center gap-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
			>
				<IconButton
					size='sm'
					tabIndex={-1}
					label={`Run ${node.label}`}
					icon={<Play size={12} />}
					onClick={() => onRun(node)}
				/>
				{node.kind !== 'file' && (
					<IconButton
						size='sm'
						tabIndex={-1}
						label={`Debug ${node.label} with pdb`}
						icon={<Bug size={12} />}
						onClick={() => onDebug(node)}
					/>
				)}
			</span>
		</li>
	);
}

import { CircleAlert, CircleCheck, Info, Sparkles, TriangleAlert } from 'lucide-react';
import { type JSX, useMemo, useState } from 'react';

import { cn } from '../../lib/cn';
import { requestOpenFile } from '../../stores/workbench-store';
import { EmptyState } from '../../ui/EmptyState';
import { FileBadge } from '../../ui/FileBadge';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { askAiAboutProblem } from '../ai/actions';
import { type Problem, useProblems } from './problems-store';

const ICON = {
	error: <CircleAlert size={13} className='shrink-0 text-down' />,
	warning: <TriangleAlert size={13} className='shrink-0 text-warn' />,
	info: <Info size={13} className='shrink-0 text-info' />,
};

export function ProblemsView(): JSX.Element {
	const items = useProblems((s) => s.items);
	const [filter, setFilter] = useState('');
	const groups = useMemo(() => {
		const f = filter.trim().toLowerCase();
		const byFile = new Map<string, Problem[]>();
		for (const p of items) {
			if (f && !`${p.path} ${p.message} ${p.source}`.toLowerCase().includes(f)) continue;
			byFile.set(p.path, [...(byFile.get(p.path) ?? []), p]);
		}
		return [...byFile.entries()];
	}, [items, filter]);

	if (items.length === 0) {
		return (
			<EmptyState
				icon={<CircleCheck size={22} className='text-up' />}
				title='No problems'
				description='Errors from the language servers and the secret shield show up here.'
			/>
		);
	}
	return (
		<div className='flex h-full flex-col'>
			<div className='flex items-center gap-2 px-3 py-1.5'>
				<Input
					value={filter}
					onChange={(e) => setFilter(e.target.value)}
					placeholder='Filter problems'
					className='h-6 max-w-72 text-12'
				/>
			</div>
			<div
				className='min-h-0 flex-1 overflow-auto pb-2 text-12'
				role='tree'
				aria-label='Problems'
			>
				{groups.map(([path, problems]) => (
					<div key={path} role='group'>
						<div className='flex h-6 items-center gap-2 px-3 text-fg-1'>
							<FileBadge name={path.split('/').at(-1) ?? path} />
							<span className='truncate'>{path}</span>
							<span className='num rounded-full bg-bg-3 px-1.5 text-10'>
								{problems.length}
							</span>
						</div>
						{problems.map((p, i) => (
							<div
								key={`${p.line}:${p.column}:${i}`}
								role='treeitem'
								tabIndex={0}
								onClick={() =>
									requestOpenFile({
										path: p.path,
										line: p.line,
										column: p.column,
									})
								}
								onKeyDown={(e) =>
									e.key === 'Enter' &&
									requestOpenFile({
										path: p.path,
										line: p.line,
										column: p.column,
									})
								}
								className={cn(
									'group flex min-h-6 cursor-default items-start gap-2 py-0.5 pr-2 pl-7 outline-none',
									'hover:bg-accent-faint focus-visible:bg-accent-faint',
								)}
							>
								<span className='mt-[3px]'>{ICON[p.severity]}</span>
								<span className='selectable min-w-0 flex-1 text-fg-0'>
									{p.message}
								</span>
								<span className='shrink-0 text-11 text-fg-2'>{p.source}</span>
								<span className='num shrink-0 text-11 text-fg-2'>
									[{p.line}:{p.column}]
								</span>
								<IconButton
									size='sm'
									label='Fix with AI'
									icon={<Sparkles size={12} />}
									onClick={(e) => {
										e.stopPropagation();
										void askAiAboutProblem(p);
									}}
									// Enter/Space on the button must not also open the file via the row.
									onKeyDown={(e) => e.stopPropagation()}
									className='-my-0.5 shrink-0 text-accent-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100'
								/>
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	);
}

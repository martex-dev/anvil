import { CircleAlert, CircleCheck, Info, SearchX, Sparkles, TriangleAlert } from 'lucide-react';
import { type JSX, useMemo, useState } from 'react';

import { cn } from '../../lib/cn';
import { rovingKeyDown } from '../../lib/roving';
import { requestOpenFile } from '../../stores/workbench-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { FileBadge } from '../../ui/FileBadge';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { askAiAboutProblem } from '../ai/actions';
import {
	groupProblems,
	problemKeys,
	SEVERITIES,
	type Severity,
	severityCounts,
} from './problems-model';
import { useProblems } from './problems-store';

const LABEL: Record<Severity, string> = { error: 'Errors', warning: 'Warnings', info: 'Infos' };

const ICON: Record<Severity, JSX.Element> = {
	error: <CircleAlert size={13} className='shrink-0 text-down' />,
	warning: <TriangleAlert size={13} className='shrink-0 text-warn' />,
	info: <Info size={13} className='shrink-0 text-info' />,
};

export function ProblemsView(): JSX.Element {
	const items = useProblems((s) => s.items);
	const [filter, setFilter] = useState('');
	const [shown, setShown] = useState<ReadonlySet<Severity>>(() => new Set(SEVERITIES));
	const counts = useMemo(() => severityCounts(items), [items]);
	const groups = useMemo(() => groupProblems(items, filter, shown), [items, filter, shown]);
	const toggleSeverity = (s: Severity): void => {
		const next = new Set(shown);
		if (!next.delete(s)) next.add(s);
		setShown(next);
	};
	const filtered = filter.trim() !== '' || shown.size < SEVERITIES.length;
	const clearFilters = (): void => {
		setFilter('');
		setShown(new Set(SEVERITIES));
	};
	const keys = useMemo(
		() => new Map(groups.map(([path, problems]) => [path, problemKeys(problems)])),
		[groups],
	);
	// Roving tabindex: the tree is one Tab stop (the last focused row, else the first) and the
	// arrow keys move between rows.
	const [lastFocused, setLastFocused] = useState<string | null>(null);
	const rowIds = groups.flatMap(([path]) => (keys.get(path) ?? []).map((k) => `${path}|${k}`));
	const tabStop = lastFocused && rowIds.includes(lastFocused) ? lastFocused : rowIds[0];

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
					aria-label='Filter problems'
					className='h-6 max-w-72 text-12'
				/>
				<div role='group' aria-label='Show severities' className='flex items-center gap-1'>
					{SEVERITIES.map((s) => (
						<button
							key={s}
							type='button'
							aria-pressed={shown.has(s)}
							aria-label={`${LABEL[s]}: ${counts[s]}`}
							data-part='problems-severity'
							data-severity={s}
							onClick={() => toggleSeverity(s)}
							className={cn(
								'flex h-6 items-center gap-1 rounded-md border px-1.5 text-11 outline-none transition-colors transition-fast focus-visible:shadow-glow',
								shown.has(s)
									? 'border-glass-edge bg-bg-3/60 text-fg-0'
									: 'border-transparent text-fg-2 opacity-60 hover:opacity-100',
							)}
						>
							{ICON[s]}
							<span className='num'>{counts[s]}</span>
						</button>
					))}
				</div>
			</div>
			{groups.length === 0 ? (
				<EmptyState
					className='flex-1'
					icon={<SearchX size={20} />}
					title='No problems match'
					description={
						filter.trim()
							? `Nothing for “${filter.trim()}” in the severities shown.`
							: 'Every severity with problems is hidden.'
					}
					action={
						filtered && (
							<Button size='sm' onClick={clearFilters}>
								Clear filters
							</Button>
						)
					}
				/>
			) : (
				<div
					className='min-h-0 flex-1 overflow-auto pb-2 text-12'
					role='tree'
					aria-label='Problems'
					onKeyDown={rovingKeyDown}
				>
					{groups.map(([path, problems]) => (
						<div key={path} role='group' aria-label={path}>
							<div className='flex h-6 items-center gap-2 px-3 text-fg-1'>
								<FileBadge name={path.split('/').at(-1) ?? path} />
								<span className='truncate' title={path}>
									{path}
								</span>
								<span className='num rounded-full bg-bg-3 px-1.5 text-10'>
									{problems.length}
								</span>
							</div>
							{problems.map((p, i) => {
								const id = `${path}|${keys.get(path)?.[i] ?? i}`;
								const open = (): void =>
									void requestOpenFile({
										path: p.path,
										line: p.line,
										column: p.column,
									});
								return (
									<div
										key={id}
										role='treeitem'
										data-roving
										tabIndex={id === tabStop ? 0 : -1}
										onFocus={() => setLastFocused(id)}
										onClick={open}
										onKeyDown={(e) => {
											// Keys pressed on the row's own button are the button's.
											if (e.target !== e.currentTarget) return;
											if (e.key !== 'Enter' && e.key !== ' ') return;
											e.preventDefault();
											open();
										}}
										className={cn(
											'group flex min-h-6 cursor-default items-start gap-2 py-0.5 pr-2 pl-7 outline-none',
											'hover:bg-accent-faint focus-visible:bg-accent-faint focus-visible:shadow-glow',
										)}
									>
										<span className='mt-[3px]'>{ICON[p.severity]}</span>
										<span className='selectable min-w-0 flex-1 text-fg-0'>
											{p.message}
										</span>
										<span className='shrink-0 text-11 text-fg-2'>
											{p.source}
										</span>
										<span className='num shrink-0 text-11 text-fg-2'>
											[{p.line}:{p.column}]
										</span>
										<IconButton
											size='sm'
											label='Fix with AI'
											icon={<Sparkles size={12} className='text-accent-2' />}
											onClick={(e) => {
												e.stopPropagation();
												void askAiAboutProblem(p);
											}}
											tabIndex={id === tabStop ? 0 : -1}
											className='-my-0.5 shrink-0 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100'
										/>
									</div>
								);
							})}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

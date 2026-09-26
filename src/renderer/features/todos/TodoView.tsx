import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ListTodo, RefreshCw } from 'lucide-react';
import { type JSX, useMemo, useState } from 'react';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { useFsRefresh } from '../../lib/use-fs-refresh';
import { requestOpenFile } from '../../stores/workbench-store';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { FileBadge } from '../../ui/FileBadge';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import { COLOR, parseTodos, PATTERN, type Tag, TAGS } from './todo-model';

/** Every TODO / FIXME / HACK in the folder, via ripgrep. */
export function TodoView(): JSX.Element {
	const { info } = useWorkspace();
	const [only, setOnly] = useState<Tag | null>(null);
	const q = useQuery({
		queryKey: ['todos', info.root],
		queryFn: () => call('search:todos', { query: PATTERN, regex: true, caseSensitive: true }),
		enabled: Boolean(info.root),
		staleTime: 30_000,
	});
	// Adding or resolving a TODO shows up without a manual rescan.
	const client = useQueryClient();
	useFsRefresh(() => void client.invalidateQueries({ queryKey: ['todos', info.root] }));
	const items = useMemo(() => parseTodos(q.data?.files ?? []), [q.data]);
	const counts = useMemo(() => {
		const c = new Map<Tag, number>();
		for (const i of items) c.set(i.tag, (c.get(i.tag) ?? 0) + 1);
		return c;
	}, [items]);
	// A filter whose tag is gone (last FIXME fixed, other folder) has no chip to turn it off.
	const active = only && counts.has(only) ? only : null;
	const shown = active ? items.filter((i) => i.tag === active) : items;

	if (!info.root) return <EmptyState icon={<ListTodo size={20} />} title='No folder open' />;
	if (q.error) return <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />;
	return (
		<div className='flex h-full flex-col'>
			<div className='flex flex-wrap items-center gap-1 px-2 py-2'>
				{TAGS.filter((t) => counts.has(t)).map((t) => (
					<button
						key={t}
						type='button'
						aria-pressed={active === t}
						onClick={() => setOnly(active === t ? null : t)}
						className={cn(
							'flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-10 outline-none focus-visible:shadow-glow',
							active === t
								? 'border-accent/50 bg-accent-faint text-fg-0'
								: 'border-glass-edge text-fg-2 hover:text-fg-1',
						)}
					>
						<span
							className='size-1.5 rounded-full'
							style={{ backgroundColor: `var(${COLOR[t]})` }}
						/>
						{t}
						<span className='num'>{counts.get(t)}</span>
					</button>
				))}
				<span className='flex-1' />
				<IconButton
					size='sm'
					label='Rescan'
					icon={q.isFetching ? <Spinner size={12} /> : <RefreshCw size={12} />}
					onClick={() => void q.refetch()}
				/>
			</div>
			{q.data?.truncated && (
				<p className='num px-3 pb-1 text-11 text-warn'>
					{q.data.timedOut
						? `Stopped after 20 s: showing the first ${items.length}.`
						: `Showing the first ${items.length}: the folder has more.`}
				</p>
			)}
			<div className='min-h-0 flex-1 overflow-auto pb-2'>
				{q.isLoading ? (
					<div className='flex h-20 items-center justify-center'>
						<Spinner />
					</div>
				) : shown.length === 0 ? (
					<EmptyState
						icon={<ListTodo size={20} />}
						title='Nothing to do'
						description='No TODO, FIXME or HACK comments found.'
					/>
				) : (
					<ul>
						{shown.map((i) => (
							<li key={`${i.path}:${i.line}`}>
								<button
									type='button'
									onClick={() =>
										requestOpenFile({
											path: i.path,
											line: i.line,
											column: i.column,
											preview: true,
										})
									}
									className='flex w-full items-start gap-2 px-3 py-1 text-left outline-none hover:bg-bg-3/40 focus-visible:bg-accent-faint'
								>
									<span
										className='mt-0.5 w-10 shrink-0 font-mono text-10 font-bold'
										style={{ color: `var(${COLOR[i.tag]})` }}
									>
										{i.tag}
									</span>
									<span className='flex min-w-0 flex-col'>
										<span className='truncate text-12 text-fg-0' title={i.text}>
											{i.text}
										</span>
										<span
											className='flex items-center gap-1 truncate text-10 text-fg-2'
											title={`${i.path}:${i.line}`}
										>
											<FileBadge name={i.path.split('/').at(-1) ?? i.path} />
											{i.path}:{i.line}
										</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

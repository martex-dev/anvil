import { useQuery } from '@tanstack/react-query';
import { ListTodo, RefreshCw } from 'lucide-react';
import { type JSX, useMemo, useState } from 'react';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { requestOpenFile } from '../../stores/workbench-store';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { FileBadge } from '../../ui/FileBadge';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';

const TAGS = ['TODO', 'FIXME', 'HACK', 'XXX', 'BUG', 'NOTE'] as const;
type Tag = (typeof TAGS)[number];
const COLOR: Record<Tag, string> = {
	TODO: '--info',
	FIXME: '--down',
	BUG: '--down',
	HACK: '--warn',
	XXX: '--warn',
	NOTE: '--text-2',
};

// Only comment-style markers: `# TODO`, `// FIXME:`, `-- NOTE` — not the word in prose or code.
const PATTERN = String.raw`(#|//|--|/\*|\*|<!--)\s*(TODO|FIXME|HACK|XXX|BUG|NOTE)\b`;

/** Every TODO / FIXME / HACK in the folder, via ripgrep. */
export function TodoView(): JSX.Element {
	const { info } = useWorkspace();
	const [only, setOnly] = useState<Tag | null>(null);
	const q = useQuery({
		queryKey: ['todos', info.root],
		queryFn: () => call('search:run', { query: PATTERN, regex: true, caseSensitive: true }),
		enabled: Boolean(info.root),
		staleTime: 30_000,
	});
	const items = useMemo(
		() =>
			(q.data?.files ?? []).flatMap((f) =>
				f.matches.map((m) => {
					const tag = (TAGS.find((t) => m.text.includes(t)) ?? 'TODO') as Tag;
					const after = m.text
						.slice(m.text.indexOf(tag) + tag.length)
						.replace(/^[\s:()\w-]*?[:)]?\s*/, '');
					return {
						path: f.path,
						line: m.line,
						column: m.column,
						tag,
						text: after.trim() || m.text.trim(),
					};
				}),
			),
		[q.data],
	);
	const counts = useMemo(() => {
		const c = new Map<Tag, number>();
		for (const i of items) c.set(i.tag, (c.get(i.tag) ?? 0) + 1);
		return c;
	}, [items]);
	const shown = only ? items.filter((i) => i.tag === only) : items;

	if (!info.root) return <EmptyState icon={<ListTodo size={20} />} title='No folder open' />;
	if (q.error) return <ErrorState message={q.error.message} onRetry={() => void q.refetch()} />;
	return (
		<div className='flex h-full flex-col'>
			<div className='flex flex-wrap items-center gap-1 px-2 py-2'>
				{TAGS.filter((t) => counts.has(t)).map((t) => (
					<button
						key={t}
						type='button'
						onClick={() => setOnly(only === t ? null : t)}
						className={cn(
							'flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-10 outline-none focus-visible:shadow-glow',
							only === t
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
										<span className='truncate text-12 text-fg-0'>{i.text}</span>
										<span className='flex items-center gap-1 truncate text-10 text-fg-2'>
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

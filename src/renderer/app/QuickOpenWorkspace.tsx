import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Command } from 'cmdk';
import { Hash } from 'lucide-react';
import type { JSX } from 'react';

import { ErrorState } from '../ui/ErrorState';
import { workspaceSymbols } from './workspace-symbols';

/** Waits a beat so fast typing sends the language servers one query, not one per key. */
function settle(signal: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(resolve, 150);
		signal.addEventListener('abort', () => {
			clearTimeout(timer);
			reject(new DOMException('Superseded', 'AbortError'));
		});
	});
}

interface QuickOpenWorkspaceProps {
	query: string;
	root: string | null;
	itemClass: string;
	onPick: (path: string, line: number, column: number) => void;
}

const note = 'px-3 py-6 text-center text-13 text-fg-2';

/** Quick Open's `#` mode: symbols across the project, from the running language servers. */
export function QuickOpenWorkspace({
	query,
	root,
	itemClass,
	onPick,
}: QuickOpenWorkspaceProps): JSX.Element {
	const symbols = useQuery({
		queryKey: ['quick-open', 'workspace-symbols', root, query],
		queryFn: async ({ signal }) => {
			await settle(signal);
			return workspaceSymbols(query);
		},
		enabled: Boolean(root) && query.length > 0,
		placeholderData: keepPreviousData,
		staleTime: 5_000,
		retry: false,
	});

	if (!root) return <div className={note}>Open a folder first (Ctrl+O).</div>;
	if (!query)
		return <div className={note}>Type a name to search symbols across the project.</div>;
	if (symbols.isPending) return <div className='shimmer mx-2 my-3 h-6 rounded-md' />;
	if (symbols.isError) {
		return (
			<ErrorState
				title='Could not search symbols'
				message={symbols.error.message}
				onRetry={() => void symbols.refetch()}
				className='min-h-0 py-4'
			/>
		);
	}
	if (symbols.data.length === 0) {
		return (
			<div className={note}>
				No symbols match. They come from the language servers, which start when you open a
				Python or TypeScript file.
			</div>
		);
	}
	return (
		<>
			{symbols.data.map((s) => (
				<Command.Item
					key={`${s.path}:${s.line}:${s.column}:${s.name}`}
					value={`${s.path}:${s.line}:${s.column}:${s.name}`}
					onSelect={() => onPick(s.path, s.line, s.column)}
					className={itemClass}
				>
					<Hash size={12} className='shrink-0 text-accent-2' />
					<span className='truncate text-fg-0'>{s.name}</span>
					<span className='hud'>{s.kind}</span>
					<span className='truncate text-12 text-fg-2'>
						{s.container ? `${s.container} · ` : ''}
						{s.path}
					</span>
					<span className='num ml-auto text-11 text-fg-2'>{s.line}</span>
				</Command.Item>
			))}
		</>
	);
}

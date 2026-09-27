import { ChevronDown, FileText, Replace, ReplaceAll } from 'lucide-react';
import { type JSX, useState } from 'react';

import type { SearchFile, SearchMatch } from '@shared/ipc/channels/search';

import { cn } from '../../lib/cn';
import { rovingKeyDown } from '../../lib/roving';
import { requestOpenFile } from '../../stores/workbench-store';
import { IconButton } from '../../ui/IconButton';
import { fileMatchCount } from './search-count';

function Highlighted({ match }: { match: SearchMatch }): JSX.Element {
	const parts: JSX.Element[] = [];
	let at = 0;
	match.ranges.forEach(([start, end], i) => {
		if (start > at) parts.push(<span key={`t${i}`}>{match.text.slice(at, start)}</span>);
		parts.push(
			<mark key={`m${i}`} className='rounded-[2px] bg-accent-soft text-fg-0'>
				{match.text.slice(start, end)}
			</mark>,
		);
		at = end;
	});
	if (at < match.text.length) parts.push(<span key='rest'>{match.text.slice(at)}</span>);
	return <>{parts}</>;
}

/** Replace buttons on each file and line, shown while the replace row is open. */
export interface ResultReplace {
	disabled: boolean;
	onFile: (file: SearchFile) => void;
	onLine: (file: SearchFile, line: number) => void;
}

const replaceButton = 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100';

export function SearchResults({
	files,
	className,
	replace,
}: {
	files: SearchFile[];
	className?: string;
	replace?: ResultReplace | undefined;
}): JSX.Element {
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set());
	const toggle = (path: string): void => {
		const next = new Set(collapsed);
		if (next.has(path)) next.delete(path);
		else next.add(path);
		setCollapsed(next);
	};
	// Roving tabindex: the results are one Tab stop (the last focused row, else the first file)
	// and the arrow keys move between visible rows.
	const [lastFocused, setLastFocused] = useState<string | null>(null);
	const rowIds = files.flatMap((file) => [
		`f:${file.path}`,
		...(collapsed.has(file.path)
			? []
			: file.matches.map((m) => `m:${file.path}:${m.line}:${m.column}`)),
	]);
	const tabStop = lastFocused && rowIds.includes(lastFocused) ? lastFocused : rowIds[0];
	const rowProps = (id: string): { tabIndex: number; onFocus: () => void } => ({
		tabIndex: id === tabStop ? 0 : -1,
		onFocus: () => setLastFocused(id),
	});

	return (
		<ul
			className={cn('min-h-0 flex-1 overflow-y-auto pb-2', className)}
			aria-label='Search results'
			onKeyDown={rovingKeyDown}
		>
			{files.map((file) => {
				const open = !collapsed.has(file.path);
				const slash = file.path.lastIndexOf('/');
				return (
					<li key={file.path} data-search-file={file.path}>
						<div className='group flex items-center hover:bg-bg-2'>
							<button
								type='button'
								onClick={() => toggle(file.path)}
								aria-expanded={open}
								title={file.path}
								data-roving
								{...rowProps(`f:${file.path}`)}
								className='flex h-6 min-w-0 flex-1 items-center gap-1 px-2 text-left text-13 focus-visible:shadow-glow focus-visible:outline-none'
							>
								<ChevronDown
									size={12}
									className={cn(
										'shrink-0 text-fg-2 transition-transform transition-fast',
										!open && '-rotate-90',
									)}
								/>
								<FileText size={13} className='shrink-0 text-fg-2' />
								<span className='truncate text-fg-0'>
									{file.path.slice(slash + 1)}
								</span>
								<span className='truncate text-11 text-fg-2'>
									{slash > 0 ? file.path.slice(0, slash) : ''}
								</span>
								<span
									className='num ml-auto shrink-0 rounded-full bg-bg-3 px-1.5 text-11 text-fg-1'
									title={
										file.capped
											? 'Only the first matching lines of this file are listed'
											: undefined
									}
								>
									{fileMatchCount(file)}
									{file.capped && '+'}
								</span>
							</button>
							{replace && (
								<IconButton
									size='sm'
									label={`Replace in ${file.path.slice(slash + 1)}`}
									icon={<ReplaceAll size={12} />}
									disabled={replace.disabled}
									className={cn('mr-1 shrink-0', replaceButton)}
									onClick={() => replace.onFile(file)}
								/>
							)}
						</div>
						{open && (
							<ul>
								{file.matches.map((m) => (
									<li
										key={`${m.line}:${m.column}`}
										className='group flex items-center hover:bg-bg-2'
									>
										<button
											type='button'
											onClick={() =>
												requestOpenFile({
													path: file.path,
													line: m.line,
													column: m.column,
													// Browsing results reuses one preview tab.
													preview: true,
												})
											}
											className={cn(
												'flex min-w-0 flex-1 items-baseline gap-2 py-0.5 pr-2 pl-9 text-left text-12',
												'focus-visible:shadow-glow focus-visible:outline-none',
											)}
											title={`${file.path}:${m.line}`}
											data-search-match={`${file.path}:${m.line}`}
											data-roving
											{...rowProps(`m:${file.path}:${m.line}:${m.column}`)}
										>
											<span className='num w-8 shrink-0 text-right text-11 text-fg-2'>
												{m.line}
											</span>
											<span className='truncate font-mono whitespace-pre text-fg-1'>
												<Highlighted match={m} />
											</span>
										</button>
										{replace && (
											<IconButton
												size='sm'
												label={`Replace on line ${m.line}`}
												icon={<Replace size={12} />}
												disabled={replace.disabled}
												className={cn('mr-1 shrink-0', replaceButton)}
												onClick={() => replace.onLine(file, m.line)}
											/>
										)}
									</li>
								))}
							</ul>
						)}
					</li>
				);
			})}
		</ul>
	);
}

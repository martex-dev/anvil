import { useQueryClient } from '@tanstack/react-query';
import { SearchX, Table2 } from 'lucide-react';
import { type JSX, useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Kbd } from '../../ui/Kbd';
import { Spinner } from '../../ui/Spinner';
import { ColumnProfile } from './ColumnProfile';
import {
	fileName,
	formatCount,
	nextSort,
	PAGE_SIZE,
	type SortState,
	toDelimited,
} from './data-format';
import { DataGrid } from './DataGrid';
import { DataToolbar } from './DataToolbar';
import { type CellRange, type GridSelection, rangeSize, selectionRange } from './grid-selection';
import { fetchRows, useDataMeta } from './use-data-pages';

/** Clipboard exports beyond this would stall the UI and rarely paste anywhere useful. */
const MAX_COPY_ROWS = 50_000;

export function DataViewer({ path }: { path: string }): JSX.Element {
	const client = useQueryClient();
	const [filterInput, setFilterInput] = useState('');
	const [filter, setFilter] = useState('');
	const [sort, setSort] = useState<SortState | null>(null);
	const [selection, setSelection] = useState<GridSelection | null>(null);
	const [profileColumn, setProfileColumn] = useState<number | null>(null);
	const [profileOpen, setProfileOpen] = useState(true);
	const firstRowRef = useRef(0);
	const profileToggleRef = useRef<HTMLButtonElement>(null);
	const [shownPath, setShownPath] = useState(path);

	// A reused preview tab can switch files under us; view state belongs to the old file.
	if (shownPath !== path) {
		setShownPath(path);
		setFilterInput('');
		setFilter('');
		setSort(null);
		setSelection(null);
		setProfileColumn(null);
	}

	useEffect(() => {
		const timer = setTimeout(() => {
			setFilter(filterInput);
			setSelection(null);
		}, 250);
		return () => clearTimeout(timer);
	}, [filterInput]);

	const params = useMemo(() => ({ path, filter, sort }), [path, filter, sort]);
	const meta = useDataMeta(params);
	const data = meta.data;
	const columns = useMemo(() => data?.columns ?? [], [data?.columns]);
	const gridKey = useMemo(
		() => `${path}\u0000${columns.map((c) => c.name).join('\u0000')}`,
		[path, columns],
	);

	const changeSelection = (next: GridSelection | null): void => {
		setSelection(next);
		if (next) setProfileColumn(next.focus.col);
	};

	const copyRange = async (
		range: CellRange,
		sep: ',' | '\t',
		withHeader: boolean,
	): Promise<void> => {
		const bottom = Math.min(range.bottom, range.top + MAX_COPY_ROWS - 1);
		try {
			const rows = await fetchRows(client, params, range.top, bottom);
			const body = rows.map((row) => row.slice(range.left, range.right + 1));
			const header = columns.slice(range.left, range.right + 1).map((c) => c.name);
			await navigator.clipboard.writeText(
				toDelimited(withHeader ? [header, ...body] : body, sep),
			);
			const what = `${formatCount(body.length)} × ${formatCount(range.right - range.left + 1)}`;
			if (bottom < range.bottom) {
				toast.warn(`Copied the first ${formatCount(MAX_COPY_ROWS)} rows`, `${what} cells`);
			} else {
				toast.success(sep === ',' ? 'Copied as CSV' : 'Copied', `${what} cells`);
			}
		} catch (err) {
			toast.error('Copy failed', err instanceof Error ? err.message : String(err));
		}
	};

	const copyCsv = (): void => {
		if (!data || data.totalRows === 0) return;
		if (selection) {
			void copyRange(selectionRange(selection), ',', true);
			return;
		}
		const top = Math.floor(firstRowRef.current / PAGE_SIZE) * PAGE_SIZE;
		const bottom = Math.min(data.totalRows, top + PAGE_SIZE) - 1;
		void copyRange({ top, bottom, left: 0, right: columns.length - 1 }, ',', true);
	};

	const reload = async (): Promise<void> => {
		try {
			await call('data:evict', path);
			await Promise.all([
				client.resetQueries({ queryKey: ['data', 'page', path] }),
				client.resetQueries({ queryKey: ['data', 'stats', path] }),
			]);
		} catch (err) {
			toast.error('Reload failed', err instanceof Error ? err.message : String(err));
		}
	};

	const openAsText = (): void => {
		if (!requestOpenFile({ path, as: 'code' }))
			toast.error('No editor is available to open this file');
	};

	let body: JSX.Element;
	if (meta.isError) {
		body = (
			<ErrorState
				title={`Could not read ${fileName(path)}`}
				message={meta.error.message}
				onRetry={() => void meta.refetch()}
			/>
		);
	} else if (!data) {
		body = (
			<div className='flex h-full flex-col items-center justify-center gap-3'>
				<Spinner size={24} />
				<span className='hud'>Reading {fileName(path)}</span>
				<span className='shimmer h-px w-40 rounded-full' />
				<span className='text-11 text-fg-2'>
					Large files can take a few seconds the first time.
				</span>
			</div>
		);
	} else if (data.columns.length === 0) {
		body = (
			<EmptyState
				icon={<Table2 size={22} />}
				title='Empty file'
				description='No columns were found.'
			/>
		);
	} else if (data.totalRows === 0) {
		body = filter ? (
			<EmptyState
				icon={<SearchX size={22} />}
				title='No matching rows'
				description={`No cell contains “${filter}”.`}
				action={
					<Button size='sm' onClick={() => setFilterInput('')}>
						Clear filter
					</Button>
				}
			/>
		) : (
			<EmptyState
				icon={<Table2 size={22} />}
				title='No rows'
				description='The file has columns but no data.'
			/>
		);
	} else {
		body = (
			<DataGrid
				key={gridKey}
				params={params}
				columns={columns}
				totalRows={data.totalRows}
				selection={selection}
				onSelectionChange={changeSelection}
				onSort={(column) => {
					setSort((current) => nextSort(current, column));
					setSelection(null);
				}}
				onCopy={(range, options) =>
					void copyRange(range, options?.csv ? ',' : '\t', options?.header ?? false)
				}
				firstRowRef={firstRowRef}
			/>
		);
	}

	const range = selection ? selectionRange(selection) : null;
	const size = range ? rangeSize(range) : null;
	const sortedBy = sort ? columns[sort.column]?.name : undefined;

	return (
		<div className='flex h-full min-h-0 flex-col text-13'>
			<DataToolbar
				path={path}
				meta={data}
				busy={meta.isFetching && data !== undefined}
				filter={filterInput}
				onFilterChange={setFilterInput}
				onOpenAsText={openAsText}
				onCopyCsv={copyCsv}
				copyLabel={selection ? 'Copy selection as CSV' : 'Copy current page as CSV'}
				onReload={() => void reload()}
				profileOpen={profileOpen}
				onToggleProfile={() => setProfileOpen((open) => !open)}
				profileToggleRef={profileToggleRef}
			/>
			<div className='flex min-h-0 flex-1'>
				<div
					className={cn(
						'flex min-w-0 flex-1 flex-col transition-opacity transition-fast',
						meta.isPlaceholderData && 'opacity-60',
					)}
				>
					{body}
				</div>
				{profileOpen && data && data.columns.length > 0 && (
					<ColumnProfile
						path={path}
						index={profileColumn}
						column={profileColumn === null ? undefined : columns[profileColumn]}
						truncated={data.truncated}
						onClose={() => {
							setProfileOpen(false);
							// The close button unmounts with the panel; don't drop focus to <body>.
							profileToggleRef.current?.focus();
						}}
					/>
				)}
			</div>
			<div className='flex h-6 shrink-0 items-center gap-3 border-t border-glass-edge px-3 text-11 text-fg-2'>
				<span className='num'>
					{range && size
						? size.rows === 1 && size.cols === 1
							? `R${formatCount(range.top + 1)} · ${columns[range.left]?.name ?? ''}`
							: `${formatCount(size.rows)} × ${formatCount(size.cols)} selected`
						: 'No selection'}
				</span>
				{sortedBy && (
					<span className='num'>
						sorted by <span className='text-accent'>{sortedBy}</span>{' '}
						{sort?.desc ? '↓' : '↑'}
					</span>
				)}
				<span className='flex-1' />
				<span className='hidden items-center gap-1 md:flex'>
					<Kbd keys='Ctrl+C' /> copy
					<span className='mx-1'>·</span>
					<Kbd keys='Shift' />
					+click range
					<span className='mx-1'>·</span>
					<Kbd keys='Ctrl+A' /> all
				</span>
			</div>
		</div>
	);
}

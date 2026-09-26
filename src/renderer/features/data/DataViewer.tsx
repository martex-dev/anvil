import { useQueryClient } from '@tanstack/react-query';
import { SearchX, Table2 } from 'lucide-react';
import { type JSX, type KeyboardEvent, useEffect, useMemo, useRef } from 'react';

import { getCommands, runCommand } from '../../app/commands/run';
import { cn } from '../../lib/cn';
import { call, IpcCallError } from '../../lib/ipc';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { ColumnProfile } from './ColumnProfile';
import { registerDataViewer } from './data-actions';
import { fileName, initialColumnWidth, isTextFormat, nextSort } from './data-format';
import {
	changeFilter,
	type DataViewPatch,
	DEFAULT_VIEW,
	useDataViewStore,
} from './data-view-store';
import { DataGrid } from './DataGrid';
import { DataStatusBar } from './DataStatusBar';
import { DataToolbar } from './DataToolbar';
import { type GridSelection, selectionRange } from './grid-selection';
import { useDataMeta } from './use-data-pages';
import { useTableCopy } from './use-table-copy';

/** Errors an interpreter change can fix: none selected, or one without the needed packages. */
const PYTHON_ERRORS = new Set(['DATA_NO_PYTHON', 'DATA_PYTHON_FAILED']);

export function DataViewer({ path }: { path: string }): JSX.Element {
	const client = useQueryClient();
	const view = useDataViewStore((s) => s.views[path]) ?? DEFAULT_VIEW;
	const { filterInput, filter, sort, selection, profileColumn, profileOpen } = view;
	const update = (patch: DataViewPatch): void => useDataViewStore.getState().update(path, patch);
	const visibleRowsRef = useRef({ top: 0, bottom: 0 });
	const profileToggleRef = useRef<HTMLButtonElement>(null);
	const filterRef = useRef<HTMLInputElement>(null);

	const params = useMemo(() => ({ path, filter, sort }), [path, filter, sort]);
	const meta = useDataMeta(params);
	const data = meta.data;
	const columns = useMemo(() => data?.columns ?? [], [data?.columns]);
	const gridKey = useMemo(
		() => `${path}\u0000${columns.map((c) => c.name).join('\u0000')}`,
		[path, columns],
	);
	// Widths set on this exact column set survive tab switches; a new schema starts afresh.
	const savedWidths = view.widths;
	const widths = useMemo(
		() => (savedWidths?.key === gridKey ? savedWidths.values : columns.map(initialColumnWidth)),
		[savedWidths, gridKey, columns],
	);

	const { copying, copy } = useTableCopy(params, columns);

	const changeSelection = (next: GridSelection | null): void => {
		update(next ? { selection: next, profileColumn: next.focus.col } : { selection: null });
	};

	const copyCsv = (): void => {
		if (!data || data.totalRows === 0) return;
		if (selection) {
			copy(selectionRange(selection), { csv: true, header: true });
			return;
		}
		// No selection: copy exactly the rows on screen, every column.
		const { top, bottom } = visibleRowsRef.current;
		copy({ top, bottom, left: 0, right: columns.length - 1 }, { csv: true, header: true });
	};

	/**
	 * Re-reads the file. `keepRows` refetches in the background with the current rows still on
	 * screen (used when the file changes under us); otherwise the view restarts from a spinner.
	 * Either way every cached page is dropped, so no page can come from an older version.
	 */
	const reload = async (keepRows = false): Promise<void> => {
		try {
			await call('data:evict', path);
			const refresh = (queryKey: readonly unknown[]): Promise<void> =>
				keepRows
					? client.invalidateQueries({ queryKey })
					: client.resetQueries({ queryKey });
			await Promise.all([refresh(['data', 'page', path]), refresh(['data', 'stats', path])]);
		} catch (err) {
			toast.error('Reload failed', err instanceof Error ? err.message : String(err));
		}
	};

	useAnvilEvent('fs:changed', ({ files }) => {
		if (files.includes(path)) void reload(true);
	});

	// Parquet, feather and xlsx need a Python env with polars or pandas; let the user pick one
	// right here, then try again with it.
	const selectInterpreter = async (): Promise<void> => {
		const command = getCommands().find((c) => c.id === 'python.selectEnv');
		if (!command) return;
		await runCommand(command);
		await meta.refetch();
	};

	const openAsText = (): void => {
		if (data && !isTextFormat(data.format)) {
			toast.info(`${data.format.toUpperCase()} files are binary and can't be opened as text`);
			return;
		}
		if (!requestOpenFile({ path, as: 'code' }))
			toast.error('No editor is available to open this file');
	};

	const focusFilter = (): void => {
		filterRef.current?.focus();
		filterRef.current?.select();
	};

	// Re-registered every render so palette commands always see the current state.
	useEffect(() =>
		registerDataViewer(path, {
			focusFilter,
			clearFilter: () => changeFilter(path, '', true),
			copyCsv,
			reload: () => void reload(),
			toggleProfile: () => update((v) => ({ profileOpen: !v.profileOpen })),
			openAsText,
			clearSort: () => update({ sort: null, selection: null }),
		}),
	);

	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
		if (
			(event.ctrlKey || event.metaKey) &&
			!event.shiftKey &&
			event.key.toLowerCase() === 'f'
		) {
			event.preventDefault();
			focusFilter();
		}
	};

	let body: JSX.Element;
	if (meta.isError) {
		body = (
			<ErrorState
				title={`Could not read ${fileName(path)}`}
				message={meta.error.message}
				onRetry={() => void meta.refetch()}
				action={
					meta.error instanceof IpcCallError &&
					PYTHON_ERRORS.has(meta.error.code) && (
						<Button
							size='sm'
							variant='primary'
							onClick={() => void selectInterpreter()}
						>
							Select interpreter
						</Button>
					)
				}
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
					<Button size='sm' onClick={() => changeFilter(path, '', true)}>
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
				widths={widths}
				onResize={(column, width) =>
					update({
						widths: {
							key: gridKey,
							values: widths.map((w, i) => (i === column ? width : w)),
						},
					})
				}
				onSort={(column) =>
					update((v) => ({ sort: nextSort(v.sort, column), selection: null }))
				}
				onCopy={copy}
				visibleRowsRef={visibleRowsRef}
			/>
		);
	}

	return (
		<div className='flex h-full min-h-0 flex-col text-13' onKeyDown={onKeyDown}>
			<DataToolbar
				path={path}
				meta={data}
				busy={meta.isFetching && data !== undefined}
				filter={filterInput}
				onFilterChange={(value) => changeFilter(path, value)}
				onFilterClear={() => changeFilter(path, '', true)}
				onOpenAsText={openAsText}
				onCopyCsv={copyCsv}
				copying={copying}
				copyLabel={selection ? 'Copy selection as CSV' : 'Copy visible rows as CSV'}
				onReload={() => void reload()}
				profileOpen={profileOpen}
				onToggleProfile={() => update((v) => ({ profileOpen: !v.profileOpen }))}
				profileToggleRef={profileToggleRef}
				filterRef={filterRef}
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
							update({ profileOpen: false });
							// The close button unmounts with the panel; don't drop focus to <body>.
							profileToggleRef.current?.focus();
						}}
					/>
				)}
			</div>
			<DataStatusBar columns={columns} selection={selection} sort={sort} />
		</div>
	);
}

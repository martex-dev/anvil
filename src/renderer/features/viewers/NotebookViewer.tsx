import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronsDownUp, ChevronsUpDown, FileCode2, NotebookPen, RotateCw } from 'lucide-react';
import { type JSX, useMemo, useState } from 'react';

import { call } from '../../lib/ipc';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { toast } from '../../stores/toast-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import { type Notebook, notebookToScript, parseNotebook, scriptFileName } from './notebook-model';
import { NotebookCell } from './NotebookCell';
import { baseName, dirName } from './viewer-paths';

type Parsed = { ok: true; notebook: Notebook } | { ok: false; message: string };

/** Writes `<name>.py` (or a free variant) next to the notebook and opens it. */
async function convertToScript(path: string, notebook: Notebook): Promise<string> {
	const parent = dirName(path);
	const siblings = await call('fs:list', parent);
	const name = scriptFileName(baseName(path), new Set(siblings.map((entry) => entry.name)));
	const created = await call('fs:create', { parent, name, kind: 'file' });
	await call('fs:writeFile', { path: created.path, content: notebookToScript(notebook) });
	return created.path;
}

export function NotebookViewer({ path }: { path: string }): JSX.Element {
	const query = useQuery({
		queryKey: ['fs-notebook', path],
		queryFn: () => call('fs:readFile', path),
	});
	const { refetch } = query;
	// A notebook re-saved by Jupyter (or a papermill run) should refresh in place.
	useAnvilEvent('fs:changed', ({ files }) => {
		if (files.includes(path)) void refetch();
	});

	const parsed = useMemo((): Parsed | null => {
		const file = query.data;
		if (!file) return null;
		if (file.tooLarge)
			return { ok: false, message: 'This notebook is too large to open here.' };
		if (file.binary) return { ok: false, message: 'This file is binary, not notebook JSON.' };
		try {
			return { ok: true, notebook: parseNotebook(file.content) };
		} catch (error) {
			return { ok: false, message: error instanceof Error ? error.message : String(error) };
		}
	}, [query.data]);
	const notebook = parsed?.ok ? parsed.notebook : null;

	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
	const withOutputs = useMemo(
		() => notebook?.cells.filter((c) => c.outputs.length > 0).map((c) => c.id) ?? [],
		[notebook],
	);
	const allCollapsed = withOutputs.length > 0 && withOutputs.every((id) => collapsed.has(id));
	const toggle = (id: string): void =>
		setCollapsed((prev) => {
			const next = new Set(prev);
			if (!next.delete(id)) next.add(id);
			return next;
		});

	const convert = useMutation({
		mutationFn: (nb: Notebook) => convertToScript(path, nb),
		onSuccess: (created) => {
			requestOpenFile({ path: created });
			toast.success('Converted to # %% script', created);
		},
		onError: (error) => toast.error('Could not convert notebook', error.message),
	});

	let body: JSX.Element;
	if (query.isPending) {
		body = (
			<div className='flex h-full items-center justify-center'>
				<Spinner size={24} label='Loading notebook' />
			</div>
		);
	} else if (query.isError) {
		body = (
			<ErrorState
				title='Could not read notebook'
				message={query.error.message}
				onRetry={() => void refetch()}
			/>
		);
	} else if (!parsed?.ok) {
		body = (
			<ErrorState
				title='Could not parse notebook'
				message={parsed?.message ?? 'Unknown error'}
				onRetry={() => void refetch()}
			/>
		);
	} else if (parsed.notebook.cells.length === 0) {
		body = (
			<EmptyState
				icon={<NotebookPen size={24} />}
				title='Empty notebook'
				description='This notebook has no cells yet.'
			/>
		);
	} else {
		const { cells, language } = parsed.notebook;
		body = (
			<div className='animate-fade mx-auto flex w-full max-w-[1000px] flex-col gap-3 py-6 pr-8 pl-2'>
				{cells.map((cell) => (
					<NotebookCell
						key={cell.id}
						cell={cell}
						path={path}
						language={language}
						collapsed={collapsed.has(cell.id)}
						onToggleOutputs={() => toggle(cell.id)}
					/>
				))}
			</div>
		);
	}

	return (
		<div className='flex h-full min-h-0 flex-col'>
			<div className='flex h-9 shrink-0 items-center gap-2 border-b border-glass-edge px-3'>
				<span className='hud'>Notebook</span>
				<span className='truncate text-12 text-fg-1'>{baseName(path)}</span>
				{notebook && (
					<>
						<Badge tone='accent'>{notebook.kernel ?? notebook.language}</Badge>
						<span className='hud num'>
							{notebook.cells.length} cell{notebook.cells.length === 1 ? '' : 's'}
						</span>
						<span className='hud'>read-only</span>
					</>
				)}
				<span className='flex-1' />
				{query.isFetching && !query.isPending && <Spinner size={12} label='Refreshing' />}
				<IconButton
					size='sm'
					label={allCollapsed ? 'Expand all outputs' : 'Collapse all outputs'}
					icon={
						allCollapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />
					}
					disabled={withOutputs.length === 0}
					onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(withOutputs))}
				/>
				<IconButton
					size='sm'
					label='Reload from disk'
					icon={<RotateCw size={14} />}
					onClick={() => void refetch()}
				/>
				<Button
					size='sm'
					variant='ghost'
					icon={<FileCode2 size={13} />}
					loading={convert.isPending}
					disabled={!notebook || notebook.cells.length === 0}
					onClick={() => notebook && convert.mutate(notebook)}
				>
					Convert to # %% script
				</Button>
			</div>
			<div
				tabIndex={0}
				aria-label='Notebook cells'
				className='min-h-0 flex-1 overflow-auto focus-visible:outline-none'
			>
				{body}
			</div>
		</div>
	);
}

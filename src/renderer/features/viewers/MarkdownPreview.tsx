import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePenLine, FileText, RotateCw } from 'lucide-react';
import { type JSX, useEffect, useState } from 'react';

import { call } from '../../lib/ipc';
import { useAnvilEvent } from '../../lib/use-anvil-event';
import { requestOpenFile } from '../../stores/workbench-store';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import { useEditorStore } from '../editor/editor-store';
import { getModel } from '../editor/file-ops';
import { MarkdownHtml } from './MarkdownHtml';
import { useViewerActions } from './viewer-actions';
import { baseName } from './viewer-paths';

const DEBOUNCE_MS = 150;

type TextModel = NonNullable<ReturnType<typeof getModel>>;

/** Follows the editor buffer while the file is open there, so the preview tracks unsaved edits. */
function useLiveBuffer(path: string): string | null {
	const open = useEditorStore((s) => s.files.some((f) => f.path === path && f.state === 'ready'));
	const model = open ? getModel(path) : null;
	const [snapshot, setSnapshot] = useState<{ model: TextModel; text: string } | null>(null);

	useEffect(() => {
		if (!model) return;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const change = model.onDidChangeContent(() => {
			clearTimeout(timer);
			timer = setTimeout(() => setSnapshot({ model, text: model.getValue() }), DEBOUNCE_MS);
		});
		const dispose = model.onWillDispose(() => {
			clearTimeout(timer);
			setSnapshot(null);
		});
		return () => {
			clearTimeout(timer);
			change.dispose();
			dispose.dispose();
		};
	}, [model]);

	if (!model || model.isDisposed()) return null;
	return snapshot?.model === model ? snapshot.text : model.getValue();
}

function wordCount(text: string): number {
	return text.split(/\s+/).filter(Boolean).length;
}

export function MarkdownPreview({ path }: { path: string }): JSX.Element {
	const live = useLiveBuffer(path);
	const client = useQueryClient();
	const diskKey = ['fs-text', path];
	const disk = useQuery({
		queryKey: diskKey,
		queryFn: () => call('fs:readFile', path),
		enabled: live === null,
	});
	const { refetch } = disk;

	// Invalidate even while the editor buffer is shown: the disabled query is then marked stale,
	// so closing the editor re-reads the saved file instead of showing the pre-edit cache.
	useAnvilEvent('fs:changed', ({ files }) => {
		if (files.includes(path)) void client.invalidateQueries({ queryKey: diskKey });
	});

	const editSource = (): void => {
		requestOpenFile({ path, as: 'code' });
	};
	useViewerActions('markdown', path, { reload: () => void refetch(), editSource });

	const text =
		live ?? (disk.data && !disk.data.binary && !disk.data.tooLarge ? disk.data.content : null);

	let body: JSX.Element;
	if (live === null && disk.isPending) {
		body = (
			<div className='flex h-full items-center justify-center'>
				<Spinner size={24} label='Loading preview' />
			</div>
		);
	} else if (live === null && disk.isError) {
		body = (
			<ErrorState
				title='Could not read this file'
				message={disk.error.message}
				onRetry={() => void refetch()}
			/>
		);
	} else if (text === null) {
		body = (
			<ErrorState
				title='Nothing to preview'
				message={
					disk.data?.tooLarge
						? 'This file is too large to preview.'
						: 'This file is binary, not Markdown text.'
				}
			/>
		);
	} else if (!text.trim()) {
		body = (
			<EmptyState
				icon={<FileText size={24} />}
				title='Empty document'
				description='Start writing in the editor and the preview follows as you type.'
			/>
		);
	} else {
		body = (
			<article className='animate-fade mx-auto w-full max-w-[760px] px-8 pt-8 pb-16'>
				<MarkdownHtml text={text} path={path} />
			</article>
		);
	}

	return (
		<div className='flex h-full min-h-0 flex-col'>
			<div className='flex h-9 shrink-0 items-center gap-2 border-b border-glass-edge px-3'>
				<span className='hud'>Preview</span>
				<span className='truncate text-12 text-fg-1' title={path}>
					{baseName(path)}
				</span>
				{live !== null && (
					<span
						className='hud flex items-center gap-1.5 text-accent'
						title='Following unsaved edits'
					>
						<span className='pulse-dot size-1.5 rounded-full bg-accent' />
						Live
					</span>
				)}
				<span className='flex-1' />
				{text?.trim() && (
					<span className='hud num'>{wordCount(text).toLocaleString()} words</span>
				)}
				{live === null && (
					<IconButton
						size='sm'
						label='Reload from disk'
						icon={
							<RotateCw
								size={14}
								className={
									disk.isFetching ? 'animate-spin motion-reduce:animate-none' : ''
								}
							/>
						}
						onClick={() => void refetch()}
					/>
				)}
				<IconButton
					size='sm'
					label='Edit source'
					icon={<FilePenLine size={14} />}
					onClick={editSource}
				/>
			</div>
			<div
				tabIndex={0}
				aria-label='Markdown preview'
				className='min-h-0 flex-1 overflow-auto focus-visible:-outline-offset-1'
			>
				{body}
			</div>
		</div>
	);
}

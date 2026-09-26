import { Equal } from 'lucide-react';
import type * as Monaco from 'monaco-editor';
import { type JSX, useEffect, useRef, useState } from 'react';

import { cn } from '../../lib/cn';
import type { MonacoApi } from '../../lib/monaco/setup';
import type { DiffPayload } from '../../stores/tabs-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { useViewerActions } from './viewer-actions';

/** Side-by-side (or inline) read-only diff: git changes, local history, AI proposals. */
export function DiffViewer({
	diff,
	monaco,
}: {
	diff: DiffPayload;
	monaco: MonacoApi;
}): JSX.Element {
	const hostRef = useRef<HTMLDivElement>(null);
	const [inline, setInline] = useState(false);
	// Tagged with the diff they were counted for, so a new payload never shows the old counts.
	const [counted, setCounted] = useState<{
		diff: DiffPayload;
		added: number;
		removed: number;
	} | null>(null);
	const stats = counted?.diff === diff ? counted : null;
	const identical = stats !== null && stats.added === 0 && stats.removed === 0;
	const editorRef = useRef<Monaco.editor.IStandaloneDiffEditor | null>(null);
	// Read when the editor is recreated for a new diff, so it keeps the chosen layout.
	const inlineRef = useRef(inline);

	useEffect(() => {
		if (!hostRef.current) return;
		const editor = monaco.editor.createDiffEditor(hostRef.current, {
			automaticLayout: true,
			readOnly: true,
			originalEditable: false,
			renderSideBySide: !inlineRef.current,
			ignoreTrimWhitespace: false,
			renderOverviewRuler: true,
			hideUnchangedRegions: { enabled: true },
		});
		editorRef.current = editor;
		const original = monaco.editor.createModel(diff.original, diff.language ?? undefined);
		const modified = monaco.editor.createModel(diff.modified, diff.language ?? undefined);
		editor.setModel({ original, modified });
		const sub = editor.onDidUpdateDiff(() => {
			const changes = editor.getLineChanges() ?? [];
			let added = 0;
			let removed = 0;
			for (const c of changes) {
				if (c.modifiedEndLineNumber >= c.modifiedStartLineNumber)
					added += c.modifiedEndLineNumber - c.modifiedStartLineNumber + 1;
				if (c.originalEndLineNumber >= c.originalStartLineNumber)
					removed += c.originalEndLineNumber - c.originalStartLineNumber + 1;
			}
			setCounted({ diff, added, removed });
		});
		return () => {
			sub.dispose();
			editor.dispose();
			original.dispose();
			modified.dispose();
			editorRef.current = null;
		};
	}, [monaco, diff]);

	useEffect(() => {
		inlineRef.current = inline;
		editorRef.current?.updateOptions({ renderSideBySide: !inline });
	}, [inline]);

	const toggleInline = (): void => setInline((v) => !v);
	useViewerActions('diff', diff, { toggleInline });

	return (
		<div className='flex h-full flex-col'>
			<div className='flex h-9 shrink-0 items-center gap-3 border-b border-glass-edge px-3'>
				<span className='hud'>diff</span>
				<span className='truncate text-12 text-fg-1' title={diff.title}>
					{diff.title}
				</span>
				{stats && (
					<span className='num flex gap-2 text-11'>
						<span className='text-up'>+{stats.added}</span>
						<span className='text-down'>−{stats.removed}</span>
					</span>
				)}
				<span className='flex-1' />
				<Button size='sm' variant='ghost' onClick={toggleInline}>
					{inline ? 'Side by side' : 'Inline'}
				</Button>
				{diff.path && (
					<Button
						size='sm'
						variant='ghost'
						onClick={() => requestOpenFile({ path: diff.path ?? '' })}
					>
						Open file
					</Button>
				)}
			</div>
			{identical && (
				<EmptyState
					icon={<Equal size={22} />}
					title='No differences'
					description='Both sides have the same content.'
				/>
			)}
			{/* Stays mounted (only hidden) so the editor survives while the diff is identical. */}
			<div ref={hostRef} className={cn('min-h-0 flex-1', identical && 'hidden')} />
		</div>
	);
}

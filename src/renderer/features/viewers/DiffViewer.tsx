import type * as Monaco from 'monaco-editor';
import { type JSX, useEffect, useRef, useState } from 'react';

import type { MonacoApi } from '../../lib/monaco/setup';
import type { DiffPayload } from '../../stores/tabs-store';
import { requestOpenFile } from '../../stores/workbench-store';
import { Button } from '../../ui/Button';

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
	const [stats, setStats] = useState<{ added: number; removed: number } | null>(null);
	const editorRef = useRef<Monaco.editor.IStandaloneDiffEditor | null>(null);

	useEffect(() => {
		if (!hostRef.current) return;
		const editor = monaco.editor.createDiffEditor(hostRef.current, {
			automaticLayout: true,
			readOnly: true,
			originalEditable: false,
			renderSideBySide: true,
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
			setStats({ added, removed });
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
		editorRef.current?.updateOptions({ renderSideBySide: !inline });
	}, [inline]);

	return (
		<div className='flex h-full flex-col'>
			<div className='flex h-9 shrink-0 items-center gap-3 border-b border-glass-edge px-3'>
				<span className='hud'>diff</span>
				<span className='truncate text-12 text-fg-1'>{diff.title}</span>
				{stats && (
					<span className='num flex gap-2 text-11'>
						<span className='text-up'>+{stats.added}</span>
						<span className='text-down'>−{stats.removed}</span>
					</span>
				)}
				<span className='flex-1' />
				<Button size='sm' variant='ghost' onClick={() => setInline((v) => !v)}>
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
			<div ref={hostRef} className='min-h-0 flex-1' />
		</div>
	);
}

import type { JSX } from 'react';

import { runCommandById } from '../../app/commands/run';
import { useEditorStore } from '../../features/editor/editor-store';
import { StatusSeg } from './StatusSeg';

/** vim's ruler: filetype, format, indent, then `Ln:Col` and how far down the file you are. */
export function StatusCursor(): JSX.Element | null {
	const cursor = useEditorStore((s) => s.cursor);
	if (!cursor) return null;
	const pct =
		cursor.line <= 1
			? 'Top'
			: cursor.line >= cursor.lines
				? 'Bot'
				: `${Math.round((cursor.line / Math.max(cursor.lines, 1)) * 100)}%`;
	return (
		<>
			<StatusSeg title='Language'>{cursor.language}</StatusSeg>
			<StatusSeg title='Encoding and line endings'>
				utf-8[{cursor.eol === 'CRLF' ? 'dos' : 'unix'}]
			</StatusSeg>
			<StatusSeg title='Indentation'>
				{cursor.insertSpaces ? `sw=${cursor.tabSize}` : `ts=${cursor.tabSize}`}
			</StatusSeg>
			<StatusSeg
				rev
				onClick={() => runCommandById('go.line')}
				title='Go to line (Ctrl+G)'
				className='mf-ruler'
			>
				<span>
					{cursor.line}:{cursor.column}
				</span>
				{cursor.selected > 0 && <span>({cursor.selected})</span>}
				<span>{pct}</span>
			</StatusSeg>
		</>
	);
}

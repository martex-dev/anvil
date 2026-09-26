import type { JSX } from 'react';

import { runCommandById } from '../../app/commands/run';
import { useEditorStore } from '../../features/editor/editor-store';
import { StatusCell } from './StatusCell';

/** Caret coordinates, selection and file format, as position telemetry. */
export function CursorReadout(): JSX.Element | null {
	const cursor = useEditorStore((s) => s.cursor);
	if (!cursor) return null;
	return (
		<>
			<StatusCell
				tag='POS'
				onClick={() => runCommandById('go.line')}
				title='Go to line (Ctrl+G)'
			>
				<span className='num ho-cell-value'>
					{cursor.line}:{cursor.column}
				</span>
				{cursor.selected > 0 && (
					<span className='num text-accent'>
						[{cursor.selected} sel
						{cursor.selectedLines > 1 && ` · ${cursor.selectedLines} ln`}
						{cursor.selectedWords > 0 && ` · ${cursor.selectedWords} w`}]
					</span>
				)}
			</StatusCell>
			<StatusCell title='Indentation · encoding · line endings' className='ho-cell-format'>
				<span className='num ho-cell-unit'>
					{cursor.insertSpaces ? `SPC ${cursor.tabSize}` : `TAB ${cursor.tabSize}`} ·
					UTF-8 · {cursor.eol}
				</span>
			</StatusCell>
			<StatusCell tag='LANG' title='Language' className='ho-cell-lang'>
				<span className='ho-cell-value'>{cursor.language}</span>
			</StatusCell>
		</>
	);
}
